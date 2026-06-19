#!/usr/bin/env python3
"""校验并渲染重建后的试卷 PDF。"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

try:
    from pypdf import PdfReader
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


def embedded_fonts(reader: PdfReader) -> set[str]:
    names: set[str] = set()
    for page in reader.pages:
        resources = page.get("/Resources") or {}
        fonts = resources.get("/Font") or {}
        for reference in fonts.values():
            font = reference.get_object()
            descendants = font.get("/DescendantFonts") or []
            candidates = [font, *[item.get_object() for item in descendants]]
            for candidate in candidates:
                descriptor = candidate.get("/FontDescriptor")
                if not descriptor:
                    continue
                descriptor = descriptor.get_object()
                if any(key in descriptor for key in ("/FontFile", "/FontFile2", "/FontFile3")):
                    names.add(str(candidate.get("/BaseFont", "unknown")))
    return names


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


def render_pdf(pdf: Path, output_dir: Path, dpi: int) -> list[str]:
    executable = shutil.which("pdftoppm")
    if not executable:
        raise RuntimeError("找不到 pdftoppm。请安装 Poppler，或把其 bin 目录加入 PATH。")
    output_dir.mkdir(parents=True, exist_ok=True)
    prefix = output_dir / "page"
    command = [executable, "-png", "-r", str(dpi), str(pdf), str(prefix)]
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    return sorted(str(path) for path in output_dir.glob("page-*.png"))


def main() -> int:
    args = parse_args()
    failures: list[str] = []
    warnings: list[str] = []
    rendered: list[str] = []

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

    fonts = embedded_fonts(reader)
    if not fonts:
        failures.append("未检测到嵌入字体")

    if contains_javascript(reader):
        failures.append("PDF 包含 JavaScript")

    if args.render_dir:
        try:
            rendered = render_pdf(args.pdf, args.render_dir, args.render_dpi)
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
        "missing_required": missing,
        "forbidden_present": forbidden_present,
        "rendered_files": rendered,
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
            print(f"渲染文件：{len(rendered)} 张，目录 {args.render_dir}")
        print(f"SHA-256：{digest}")
        for warning in warnings:
            print(f"警告：{warning}")
        for failure in failures:
            print(f"失败：{failure}")

    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
