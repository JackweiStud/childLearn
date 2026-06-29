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

# 题级来源与置信度的合法取值，与 questions-json-schema.md 保持一致。
# 强校验题级标记，防止生成出"无来源标记却校验通过"的 questions.json，
# 否则中间层"可审计"承诺形同虚设。
VALID_SOURCES = {
    "image_clear",
    "user_confirmed",
    "original_exam_verified",
    "context_inferred",
    "needs_user_confirmation",
}
VALID_CONFIDENCE = {"high", "medium", "low", "pending"}


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


def _validate_questions(page_number: int, questions: list[Any]) -> list[str]:
    """校验每道题带合法来源与置信度标记；空题列表（未转写骨架）直接放行。"""
    issues: list[str] = []
    for position, question in enumerate(questions, 1):
        where = f"第 {page_number} 页第 {position} 题"
        if not isinstance(question, dict):
            issues.append(f"{where} 必须是对象")
            continue
        if not str(question.get("id", "")).strip():
            issues.append(f"{where} 缺少 id")
        if not str(question.get("text", "")).strip():
            issues.append(f"{where} 缺少 text")
        source = question.get("source")
        if source not in VALID_SOURCES:
            issues.append(f"{where} source 非法（{source!r}），必须是 {sorted(VALID_SOURCES)}")
        confidence = question.get("confidence")
        if confidence not in VALID_CONFIDENCE:
            issues.append(f"{where} confidence 非法（{confidence!r}），必须是 {sorted(VALID_CONFIDENCE)}")
        # 上下文推断必须在 notes 留证据，禁止把推断伪装成原图事实。
        if source == "context_inferred":
            notes = question.get("notes")
            if not isinstance(notes, list) or not any(str(n).strip() for n in notes):
                issues.append(f"{where} 标记 context_inferred 但 notes 为空，必须说明推断依据")
    return issues


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
        questions = page.get("questions")
        if not isinstance(questions, list):
            issues.append(f"第 {index} 页 questions 必须是数组")
        else:
            issues.extend(_validate_questions(index, questions))

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
