#!/usr/bin/env python3
"""校验并渲染重建后的试卷 PDF。"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

try:
    from pypdf import PdfReader
    from pypdf.generic import ContentStream
except ImportError:
    print("错误：缺少 pypdf。请使用 Codex 文档运行时，或安装 pypdf 后重试。", file=sys.stderr)
    raise SystemExit(2)


A4_WIDTH = 595.276
A4_HEIGHT = 841.890


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="校验试卷 PDF 的页数、尺寸、字体和关键文字。")
    parser.add_argument("pdf", type=Path, help="待校验的 PDF 文件")
    parser.add_argument("--expected-pages", type=int, help="预期页数")
    parser.add_argument("--page-size", choices=["a4", "any"], default="a4", help="预期纸张尺寸")
    parser.add_argument("--required", action="append", default=[], help="必须出现的文字，可重复传入")
    parser.add_argument("--forbidden", action="append", default=[], help="禁止出现的文字，可重复传入")
    parser.add_argument("--render-dir", type=Path, help="把每页渲染为 PNG 的目录")
    parser.add_argument("--render-dpi", type=int, default=170, help="渲染 DPI，默认 170")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    return parser.parse_args()


def normalize_text(value: str) -> str:
    return "".join(value.split())


def page_size_is_a4(page: Any, tolerance: float = 2.0) -> bool:
    width = float(page.mediabox.width)
    height = float(page.mediabox.height)
    portrait = abs(width - A4_WIDTH) <= tolerance and abs(height - A4_HEIGHT) <= tolerance
    landscape = abs(width - A4_HEIGHT) <= tolerance and abs(height - A4_WIDTH) <= tolerance
    return portrait or landscape


def font_is_embedded(font: Any) -> bool:
    if font.get("/Subtype") == "/Type3":
        # Type 3 字形程序直接存放在 PDF 内，不依赖外部字体文件。
        return True
    descendants = font.get("/DescendantFonts") or []
    candidates = [font, *[item.get_object() for item in descendants]]
    for candidate in candidates:
        descriptor = candidate.get("/FontDescriptor")
        if not descriptor:
            continue
        descriptor = descriptor.get_object()
        if any(key in descriptor for key in ("/FontFile", "/FontFile2", "/FontFile3")):
            return True
    return False


def resolve_object(value: Any) -> Any:
    return value.get_object() if hasattr(value, "get_object") else value


def collect_used_fonts(
    stream: Any,
    resources: Any,
    reader: PdfReader,
    embedded: set[str],
    unembedded: set[str],
    visited: set[int],
    initial_font: tuple[str, bool] | None = None,
) -> None:
    if stream is None:
        return

    stream = resolve_object(stream)
    marker = id(stream)
    if marker in visited:
        return
    visited.add(marker)

    resources = resolve_object(resources) if resources else {}
    fonts = resolve_object(resources.get("/Font") or {})
    xobjects = resolve_object(resources.get("/XObject") or {})

    try:
        operations = ContentStream(stream, reader).operations
    except Exception as error:
        raise ValueError(f"无法解析 PDF 内容流以检查字体：{error}") from error

    current_font = initial_font
    font_stack: list[tuple[str, bool] | None] = []

    def resolve_font(resource_name: Any) -> tuple[str, bool]:
        reference = fonts.get(resource_name)
        if reference is None:
            return f"未解析字体资源 {resource_name}", False
        font = resolve_object(reference)
        name = str(font.get("/BaseFont", resource_name))
        return name, font_is_embedded(font)

    def record_current_font() -> None:
        if current_font is None:
            unembedded.add("文字绘制时未解析到当前字体")
            return
        name, is_embedded = current_font
        target = embedded if is_embedded else unembedded
        target.add(name)

    for operands, operator in operations:
        if operator == b"Tf" and operands:
            current_font = resolve_font(operands[0])
        elif operator in (b"Tj", b"TJ", b"'", b'"'):
            record_current_font()
        elif operator == b"q":
            font_stack.append(current_font)
        elif operator == b"Q" and font_stack:
            current_font = font_stack.pop()
        elif operator == b"Do" and operands:
            reference = xobjects.get(operands[0])
            if reference is None:
                continue
            xobject = resolve_object(reference)
            if xobject.get("/Subtype") != "/Form":
                continue
            nested_resources = xobject.get("/Resources") or resources
            collect_used_fonts(
                xobject,
                nested_resources,
                reader,
                embedded,
                unembedded,
                visited,
                current_font,
            )

    visited.remove(marker)


def font_embedding_report(reader: PdfReader) -> tuple[set[str], set[str]]:
    embedded: set[str] = set()
    unembedded: set[str] = set()
    for page in reader.pages:
        collect_used_fonts(
            page.get_contents(),
            page.get("/Resources") or {},
            reader,
            embedded,
            unembedded,
            set(),
        )
    return embedded, unembedded


def contains_javascript(reader: PdfReader) -> bool:
    root = reader.trailer.get("/Root")
    if not root:
        return False
    root = root.get_object()
    names = root.get("/Names")
    if names and names.get_object().get("/JavaScript"):
        return True
    open_action = root.get("/OpenAction")
    if open_action:
        action = open_action.get_object()
        if action.get("/S") == "/JavaScript" or action.get("/JS"):
            return True
    return False


def render_pdf(pdf: Path, output_dir: Path, dpi: int) -> tuple[list[str], Path]:
    executable = shutil.which("pdftoppm")
    if not executable:
        raise RuntimeError("找不到 pdftoppm。请安装 Poppler，或把其 bin 目录加入 PATH。")
    output_dir.mkdir(parents=True, exist_ok=True)
    run_dir = Path(tempfile.mkdtemp(prefix=f"{pdf.stem}-", dir=str(output_dir)))
    prefix = run_dir / "page"
    command = [executable, "-png", "-r", str(dpi), str(pdf), str(prefix)]
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    return sorted(str(path) for path in run_dir.glob("page-*.png")), run_dir


def main() -> int:
    args = parse_args()
    failures: list[str] = []
    warnings: list[str] = []
    rendered: list[str] = []
    actual_render_dir: Path | None = None

    if not args.pdf.is_file():
        print(f"错误：文件不存在：{args.pdf}", file=sys.stderr)
        return 2

    try:
        reader = PdfReader(str(args.pdf))
    except Exception as error:
        print(f"错误：无法读取 PDF：{error}", file=sys.stderr)
        return 2

    if reader.is_encrypted:
        failures.append("PDF 已加密")

    page_count = len(reader.pages)
    if args.expected_pages is not None and page_count != args.expected_pages:
        failures.append(f"页数不符：预期 {args.expected_pages}，实际 {page_count}")

    if args.page_size == "a4":
        bad_pages = [index for index, page in enumerate(reader.pages, 1) if not page_size_is_a4(page)]
        if bad_pages:
            failures.append(f"以下页面不是 A4：{bad_pages}")

    extracted = normalize_text("\n".join(page.extract_text() or "" for page in reader.pages))
    missing = [text for text in args.required if normalize_text(text) not in extracted]
    forbidden_present = [text for text in args.forbidden if normalize_text(text) in extracted]
    if missing:
        failures.append(f"缺少必需文字：{missing}")
    if forbidden_present:
        failures.append(f"发现禁止文字：{forbidden_present}")

    fonts, unembedded_fonts = font_embedding_report(reader)
    if not fonts and not unembedded_fonts:
        failures.append("未检测到字体资源")
    if unembedded_fonts:
        failures.append(f"发现未嵌入字体：{sorted(unembedded_fonts)}")

    if contains_javascript(reader):
        failures.append("PDF 包含 JavaScript")

    if args.render_dir:
        try:
            rendered, actual_render_dir = render_pdf(args.pdf, args.render_dir, args.render_dpi)
        except Exception as error:
            failures.append(f"渲染失败：{error}")
        if rendered and len(rendered) != page_count:
            failures.append(f"渲染页数不符：PDF {page_count} 页，PNG {len(rendered)} 张")

    digest = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
    result = {
        "status": "通过" if not failures else "失败",
        "pdf": str(args.pdf.resolve()),
        "pages": page_count,
        "embedded_fonts": sorted(fonts),
        "unembedded_fonts": sorted(unembedded_fonts),
        "missing_required": missing,
        "forbidden_present": forbidden_present,
        "rendered_files": rendered,
        "render_dir": str(actual_render_dir) if actual_render_dir else None,
        "warnings": warnings,
        "failures": failures,
        "sha256": digest,
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"状态：{result['status']}")
        print(f"页数：{page_count}")
        print(f"嵌入字体：{len(fonts)} 组")
        if rendered:
            print(f"渲染文件：{len(rendered)} 张，目录 {actual_render_dir}")
        print(f"SHA-256：{digest}")
        for warning in warnings:
            print(f"警告：{warning}")
        for failure in failures:
            print(f"失败：{failure}")

    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
