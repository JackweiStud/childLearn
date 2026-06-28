#!/usr/bin/env python3
"""Preflight source images and local runtime before rebuilding an exam."""

from __future__ import annotations

import argparse
import importlib.util
import json
import shutil
from pathlib import Path
from typing import Callable

from find_font import find_fonts
from image_utils import probe_image


REQUIRED_COMMANDS = ["pdftoppm", "pdfinfo"]
REQUIRED_PYTHON_MODULES = ["reportlab", "pypdf"]


def _default_module_lookup(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def run_preflight(
    image_paths: list[Path],
    min_long_edge: int = 2000,
    strict_image_size: bool = False,
    command_lookup: Callable[[str], str | None] = shutil.which,
    module_lookup: Callable[[str], bool] = _default_module_lookup,
    font_roots: list[Path] | None = None,
) -> dict[str, object]:
    issues: list[str] = []
    warnings: list[str] = []
    images = []

    for image_path in image_paths:
        info = probe_image(Path(image_path))
        if int(info["long_edge_px"]) < min_long_edge:
            info["status"] = "low_resolution"
            message = (
                f"{info['filename']} 长边 {info['long_edge_px']}px，小于建议值 {min_long_edge}px；"
                "可继续转写，但不能仅凭该图声称无歧义"
            )
            if strict_image_size:
                issues.append(message)
            else:
                warnings.append(message)
        else:
            info["status"] = "ok"
        images.append(info)

    commands = {command: command_lookup(command) for command in REQUIRED_COMMANDS}
    missing_commands = [command for command, path in commands.items() if not path]
    for command in missing_commands:
        issues.append(f"缺少命令：{command}")

    python_modules = {name: module_lookup(name) for name in REQUIRED_PYTHON_MODULES}
    missing_python_modules = [name for name, present in python_modules.items() if not present]
    for name in missing_python_modules:
        issues.append(f"缺少 Python 模块：{name}")

    fonts = find_fonts(extra_roots=font_roots or [], require_exists=True)
    for category in fonts["missing"]:
        issues.append(f"缺少字体类别：{category}")

    status = "failed" if issues else "warning" if warnings else "passed"
    return {
        "status": status,
        "images": images,
        "commands": commands,
        "missing_commands": missing_commands,
        "python_modules": python_modules,
        "missing_python_modules": missing_python_modules,
        "fonts": fonts,
        "warnings": warnings,
        "issues": issues,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="检查源图、字体、PDF 工具和 Python 依赖。")
    parser.add_argument("images", nargs="+", type=Path, help="按页序排列的 JPG/PNG 源图")
    parser.add_argument("--min-long-edge", type=int, default=2000, help="源图长边最低像素")
    parser.add_argument("--strict-image-size", action="store_true", help="把低于建议长边的图片作为失败")
    parser.add_argument("--font-root", action="append", default=[], type=Path, help="额外字体目录")
    parser.add_argument("--json", action="store_true", help="输出 JSON")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = run_preflight(
        args.images,
        args.min_long_edge,
        strict_image_size=args.strict_image_size,
        font_roots=args.font_root,
    )
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"状态：{result['status']}")
        for warning in result["warnings"]:
            print(f"警告：{warning}")
        for issue in result["issues"]:
            print(f"问题：{issue}")
    return 0 if result["status"] != "failed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
