#!/usr/bin/env python3
"""Create and validate the persistent questions JSON model."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from image_utils import probe_image


SCHEMA = "rebuild-clean-exam.questions.v1"


def create_model(image_paths: list[Path], title: str, output: Path | None = None) -> dict[str, Any]:
    if not image_paths:
        raise ValueError("至少需要一张源图")

    pages = []
    for index, image_path in enumerate(image_paths, 1):
        pages.append(
            {
                "page_number": index,
                "source_image": probe_image(Path(image_path)),
                "rotation_degrees": 0,
                "status": "needs_transcription",
                "source_notes": [],
                "questions": [],
            }
        )

    model: dict[str, Any] = {
        "schema": SCHEMA,
        "title": title,
        "created_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "pages": pages,
        "ambiguities": [],
    }

    issues = validate_model(model)
    if issues:
        raise ValueError("; ".join(issues))

    if output is not None:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(model, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return model


def validate_model(model: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    if model.get("schema") != SCHEMA:
        issues.append(f"schema 必须是 {SCHEMA}")
    if not str(model.get("title", "")).strip():
        issues.append("title 不能为空")
    pages = model.get("pages")
    if not isinstance(pages, list) or not pages:
        issues.append("pages 必须是非空数组")
        return issues

    for index, page in enumerate(pages, 1):
        if page.get("page_number") != index:
            issues.append(f"第 {index} 页 page_number 不连续")
        source = page.get("source_image")
        if not isinstance(source, dict):
            issues.append(f"第 {index} 页缺少 source_image")
            continue
        for key in ("path", "width_px", "height_px", "sha256"):
            if key not in source:
                issues.append(f"第 {index} 页 source_image 缺少 {key}")
        if not isinstance(page.get("questions"), list):
            issues.append(f"第 {index} 页 questions 必须是数组")

    if not isinstance(model.get("ambiguities"), list):
        issues.append("ambiguities 必须是数组")
    return issues


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="从源图创建可审计的 questions.json 骨架。")
    parser.add_argument("images", nargs="+", type=Path, help="按页序排列的 JPG/PNG 源图")
    parser.add_argument("--title", required=True, help="试卷标题或工作名")
    parser.add_argument("--output", required=True, type=Path, help="输出 questions.json 路径")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    model = create_model(args.images, args.title, args.output)
    print(args.output.resolve())
    print(f"pages={len(model['pages'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
