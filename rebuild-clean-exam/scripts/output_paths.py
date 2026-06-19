#!/usr/bin/env python3
"""解析 rebuild-clean-exam 的默认 PDF 输出路径。"""

from __future__ import annotations

import argparse
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
OUT_PDF_DIR = SKILL_ROOT / "outPdfFile"


def output_pdf_path(filename: str) -> Path:
    """返回项目内的 PDF 输出路径，并确保输出目录存在。"""
    name = Path(filename)
    if name.name != filename or name.suffix.lower() != ".pdf":
        raise ValueError("filename 必须是不含目录的 .pdf 文件名")
    OUT_PDF_DIR.mkdir(parents=True, exist_ok=True)
    return OUT_PDF_DIR / name.name


def main() -> int:
    parser = argparse.ArgumentParser(description="输出项目内默认 PDF 文件路径。")
    parser.add_argument("filename", help="不含目录的 PDF 文件名")
    args = parser.parse_args()
    print(output_pdf_path(args.filename))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
