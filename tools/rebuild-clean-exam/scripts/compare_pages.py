#!/usr/bin/env python3
"""把原始照片与重建后的 PDF 渲染图并排拼成对比图，强制逐题视觉交叉校验。

为什么需要：内容准确性是本 Skill 的第一硬约束，但"渲染后自己看一眼"等于凭记忆
确认，挡不住把数字看错、漏题、单位写错。把原图和重建图并排拼到同一张图上，让模型
做"原图 vs 重建图"的逐题 diff，是唯一能系统性拦住内容错误的低成本手段。

输入 questions.json（提供页序与源图事实）+ 重建后的 PDF；输出每页一张 source|rebuilt
对比图，供逐页读图核对，并把发现回写 questions.json 的 confidence / ambiguities。
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("错误：缺少 Pillow。请安装 Pillow 后重试。", file=sys.stderr)
    raise SystemExit(2)


LABEL_BAND_PX = 28
GUTTER_PX = 8
GUTTER_COLOR = (40, 40, 40)
LABEL_BG = (24, 24, 24)
LABEL_FG = (245, 245, 245)


def render_pdf_pages(pdf: Path, output_dir: Path, dpi: int) -> list[Path]:
    """用 pdftoppm 把 PDF 每页渲染为 PNG，返回按页序排列的路径。"""
    executable = shutil.which("pdftoppm")
    if not executable:
        raise RuntimeError("找不到 pdftoppm。请安装 Poppler，或把其 bin 目录加入 PATH。")
    output_dir.mkdir(parents=True, exist_ok=True)
    prefix = output_dir / "rebuilt"
    command = [executable, "-png", "-r", str(dpi), str(pdf), str(prefix)]
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    return sorted(output_dir.glob("rebuilt-*.png"))


def _label_strip(width: int, text: str) -> Image.Image:
    band = Image.new("RGB", (width, LABEL_BAND_PX), LABEL_BG)
    draw = ImageDraw.Draw(band)
    # 用 PIL 内置位图字体，避免依赖外部中文字体；标签只用英文与页码。
    draw.text((6, 7), text, fill=LABEL_FG)
    return band


def _with_label(image: Image.Image, text: str) -> Image.Image:
    canvas = Image.new("RGB", (image.width, image.height + LABEL_BAND_PX), LABEL_BG)
    canvas.paste(_label_strip(image.width, text), (0, 0))
    canvas.paste(image, (0, LABEL_BAND_PX))
    return canvas


def compose_comparison(source: Path, rebuilt: Path, out_path: Path, page_number: int) -> Path:
    """把单页源图与重建图缩放到同高后左右拼接，加页码/来源标签，写出对比 PNG。"""
    left = Image.open(source).convert("RGB")
    right = Image.open(rebuilt).convert("RGB")

    target_height = max(left.height, right.height)

    def scaled(image: Image.Image) -> Image.Image:
        if image.height == target_height:
            return image
        width = max(1, round(image.width * target_height / image.height))
        return image.resize((width, target_height), Image.LANCZOS)

    left = _with_label(scaled(left), f"P{page_number} SOURCE (original)")
    right = _with_label(scaled(right), f"P{page_number} REBUILT (pdf)")

    band_height = max(left.height, right.height)
    total_width = left.width + GUTTER_PX + right.width
    canvas = Image.new("RGB", (total_width, band_height), GUTTER_COLOR)
    canvas.paste(left, (0, 0))
    canvas.paste(right, (left.width + GUTTER_PX, 0))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path)
    return out_path


def _source_paths_from_model(model: dict) -> list[Path]:
    pages = model.get("pages")
    if not isinstance(pages, list) or not pages:
        raise ValueError("questions.json 的 pages 为空或非数组")
    paths: list[Path] = []
    for page in pages:
        source = (page or {}).get("source_image") or {}
        path = source.get("path")
        if not path:
            raise ValueError(f"第 {page.get('page_number')} 页缺少 source_image.path")
        paths.append(Path(path))
    return paths


def build_comparisons(questions_json: Path, pdf: Path, output_dir: Path, dpi: int) -> dict:
    """编排：读源图 -> 渲染 PDF -> 逐页拼接 -> 返回结果与页数核对。"""
    model = json.loads(questions_json.read_text(encoding="utf-8"))
    sources = _source_paths_from_model(model)

    render_dir = Path(tempfile.mkdtemp(prefix="rebuilt-", dir=str(output_dir.parent if output_dir.parent.exists() else output_dir)))
    try:
        rebuilt_pages = render_pdf_pages(pdf, render_dir, dpi)
    except Exception:
        shutil.rmtree(render_dir, ignore_errors=True)
        raise

    issues: list[str] = []
    if len(rebuilt_pages) != len(sources):
        issues.append(
            f"页数不符：questions.json {len(sources)} 页，PDF 渲染 {len(rebuilt_pages)} 页"
        )

    comparisons: list[str] = []
    for index, (source, rebuilt) in enumerate(zip(sources, rebuilt_pages), 1):
        out_path = output_dir / f"compare-page-{index:02d}.png"
        compose_comparison(source, rebuilt, out_path, index)
        comparisons.append(str(out_path))

    shutil.rmtree(render_dir, ignore_errors=True)

    return {
        "status": "失败" if issues else "通过",
        "source_pages": len(sources),
        "pdf_pages": len(rebuilt_pages),
        "comparisons": comparisons,
        "output_dir": str(output_dir),
        "issues": issues,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="生成源图与重建 PDF 的并排对比图，用于逐题视觉核对。")
    parser.add_argument("questions_json", type=Path, help="本卷的 questions.json")
    parser.add_argument("--pdf", required=True, type=Path, help="重建后的 PDF")
    parser.add_argument("--output-dir", required=True, type=Path, help="对比图输出目录")
    parser.add_argument("--dpi", type=int, default=160, help="PDF 渲染 DPI，默认 160")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.questions_json.is_file():
        print(f"错误：questions.json 不存在：{args.questions_json}", file=sys.stderr)
        return 2
    if not args.pdf.is_file():
        print(f"错误：PDF 不存在：{args.pdf}", file=sys.stderr)
        return 2

    args.output_dir.mkdir(parents=True, exist_ok=True)
    result = build_comparisons(args.questions_json, args.pdf, args.output_dir, args.dpi)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"状态：{result['status']}")
        print(f"源图页数：{result['source_pages']}，PDF 页数：{result['pdf_pages']}")
        print(f"对比图：{len(result['comparisons'])} 张，目录 {result['output_dir']}")
        for issue in result["issues"]:
            print(f"问题：{issue}")
    return 0 if result["status"] == "通过" else 1


if __name__ == "__main__":
    raise SystemExit(main())
