#!/usr/bin/env python3
"""Find local fonts suitable for printable Chinese exam PDFs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Iterable


CJK_CANDIDATES = [
    "NotoSansCJK-Regular.ttc",
    "NotoSansCJKsc-Regular.otf",
    "SourceHanSansSC-Regular.otf",
    "PingFang.ttc",
    "STHeiti Medium.ttc",
    "Hiragino Sans GB.ttc",
    "Arial Unicode.ttf",
    "Arial Unicode MS.ttf",
]

SYMBOL_CANDIDATES = [
    "Arial Unicode.ttf",
    "Arial Unicode MS.ttf",
    "Apple Symbols.ttf",
    "Symbol.ttf",
    "DejaVuSans.ttf",
    "NotoSansSymbols-Regular.ttf",
]

DEFAULT_FONT_ROOTS = [
    Path("/System/Library/Fonts"),
    Path("/Library/Fonts"),
    Path.home() / "Library" / "Fonts",
    Path("/usr/share/fonts"),
    Path("/usr/local/share/fonts"),
]


def _candidate_paths(names: list[str], roots: Iterable[Path]) -> list[Path]:
    paths: list[Path] = []
    for root in roots:
        for name in names:
            paths.append(root / name)
        if root.is_dir():
            for path in root.rglob("*"):
                if path.name in names:
                    paths.append(path)
    return paths


def _first_existing(names: list[str], roots: Iterable[Path]) -> dict[str, str | None]:
    seen: set[Path] = set()
    for path in _candidate_paths(names, roots):
        if path in seen:
            continue
        seen.add(path)
        if path.is_file():
            return {"path": str(path), "name": path.name}
    return {"path": None, "name": None}


def find_fonts(
    extra_roots: list[Path] | None = None,
    require_exists: bool = False,
) -> dict[str, object]:
    roots = [*(extra_roots or []), *DEFAULT_FONT_ROOTS]
    result = {
        "cjk": _first_existing(CJK_CANDIDATES, roots),
        "symbol": _first_existing(SYMBOL_CANDIDATES, roots),
        "searched_roots": [str(path) for path in roots],
        "missing": [],
    }
    missing = []
    if not result["cjk"]["path"]:
        missing.append("cjk")
    if not result["symbol"]["path"]:
        missing.append("symbol")
    result["missing"] = missing
    if require_exists and missing:
        result["status"] = "failed"
    else:
        result["status"] = "ok" if not missing else "warning"
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="查找可嵌入 PDF 的中文和符号字体。")
    parser.add_argument("--font-root", action="append", default=[], type=Path, help="额外字体目录")
    parser.add_argument("--require-exists", action="store_true", help="缺字体时返回失败状态")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = find_fonts(args.font_root, args.require_exists)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] != "failed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
