#!/usr/bin/env python3
"""Non-AI cleanup helper for obvious colored markup on source images."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

from image_utils import probe_image, sha256_file


def colored_markup_mask(image: Image.Image) -> np.ndarray:
    rgb = image.convert("RGB")
    hsv = rgb.convert("HSV")
    hsv_array = np.asarray(hsv)
    hue = hsv_array[:, :, 0]
    saturation = hsv_array[:, :, 1]
    value = hsv_array[:, :, 2]

    red_or_orange = (hue <= 32) | (hue >= 235)
    pink_or_purple = (hue >= 210) & (hue <= 245)
    strong_color = saturation >= 70
    visible = value >= 80
    not_gray_shadow = value <= 252
    return (red_or_orange | pink_or_purple) & strong_color & visible & not_gray_shadow


def clean_image(input_path: Path, output_path: Path, report_path: Path | None = None) -> dict[str, Any]:
    source_info = probe_image(input_path)
    image = Image.open(input_path).convert("RGB")
    mask = colored_markup_mask(image)
    masked_pixels = int(mask.sum())

    cleaned = np.asarray(image).copy()
    cleaned[mask] = [255, 255, 255]
    result_image = Image.fromarray(cleaned, "RGB")
    result_image = ImageEnhance.Contrast(result_image).enhance(1.08)
    result_image = ImageEnhance.Sharpness(result_image).enhance(1.15)
    result_image = result_image.filter(ImageFilter.SMOOTH_MORE)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    result_image.save(output_path)

    result = {
        "status": "warning" if masked_pixels else "passed",
        "input": source_info,
        "output": {
            "path": str(output_path.resolve()),
            "sha256": sha256_file(output_path),
        },
        "masked_pixels": masked_pixels,
        "masked_ratio": masked_pixels / (image.width * image.height),
        "warnings": [
            "仅清理明显彩色批改/圈画；黑色手写、同色覆盖和被遮挡原文仍需 OCR、AI 或人工确认"
        ],
    }

    if report_path is not None:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="用非 AI 颜色蒙版清理明显彩色批改痕迹。")
    parser.add_argument("input", type=Path, help="源 JPG/PNG 图片")
    parser.add_argument("--output", required=True, type=Path, help="清理后的图片路径")
    parser.add_argument("--report", type=Path, help="JSON 报告路径")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = clean_image(args.input, args.output, args.report)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"状态：{result['status']}")
        print(f"蒙版像素：{result['masked_pixels']} ({result['masked_ratio']:.2%})")
        print(f"输出：{result['output']['path']}")
        for warning in result["warnings"]:
            print(f"警告：{warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
