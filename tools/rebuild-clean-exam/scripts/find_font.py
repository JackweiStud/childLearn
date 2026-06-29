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

# .ttc 字体集合必须按子字体索引加载；多数 CJK 集合 index 0 即 Regular，
# 此处只为已知需要非 0 的集合显式覆盖，其余默认 0。写死单一路径而不带 index
# 是换机/换字体后取错字形或加载失败的隐患来源。
SUBFONT_INDEX: dict[str, int] = {}

# 自检字符：确认 (路径, index) 真能渲染对应字形，而不是只判断文件存在。
PROBE_CJK = "题数八"
PROBE_SYMBOL = "□"

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


# 合法字体文件头（4 字节 magic number）。fake/损坏/无关文件 magic 都不在这里。
# - 0x00010000 / b'true' / b'typ1' : TTF (TrueType)
# - b'OTTO'                         : OTF (OpenType CFF)
# - b'ttcf'                         : TTC (TrueType Collection，必须配 subfontIndex)
_FONT_MAGIC = (b"\x00\x01\x00\x00", b"true", b"typ1", b"OTTO", b"ttcf")


def _is_valid_font_file(path: str) -> bool:
    """读 4 字节 magic 判断是否是真正的字体文件。
    PIL ImageFont.truetype 在无效绝对路径加载失败时会静默 fallback 到
    /Library/Fonts/<同名> 系统字体，导致 fake/损坏的字体被误判通过——
    必须在进 PIL 前先用 magic 拦下。
    """
    try:
        with open(path, "rb") as fp:
            head = fp.read(4)
    except OSError:
        return False
    return head in _FONT_MAGIC


def _verify_render(path: str, index: int, probe: str) -> bool | None:
    """用 PIL 确认字体能画出 probe 字符；返回 None 表示无 PIL、无法自检。"""
    if not _is_valid_font_file(path):
        return False
    try:
        from PIL import ImageFont
    except ImportError:
        return None
    try:
        font = ImageFont.truetype(path, size=40, index=index)
        for char in probe:
            bbox = font.getbbox(char)
            if bbox is None or (bbox[2] - bbox[0]) <= 0 or (bbox[3] - bbox[1]) <= 0:
                return False
        return True
    except Exception:
        return False


def _resolve(names: list[str], roots: Iterable[Path], probe: str) -> dict[str, object]:
    """返回首个可用字体；优先通过自检者，并始终带 subfontIndex。"""
    seen: set[Path] = set()
    existing: list[Path] = []
    for path in _candidate_paths(names, roots):
        if path in seen:
            continue
        seen.add(path)
        if path.is_file():
            existing.append(path)

    if not existing:
        return {"path": None, "name": None, "index": None, "verified": None}

    # 优先返回通过 PIL 自检的字体；自检不可用(None)时退化为按存在顺序取首个。
    for path in existing:
        index = SUBFONT_INDEX.get(path.name, 0)
        if _verify_render(str(path), index, probe) is True:
            return {"path": str(path), "name": path.name, "index": index, "verified": True}

    path = existing[0]
    index = SUBFONT_INDEX.get(path.name, 0)
    return {
        "path": str(path),
        "name": path.name,
        "index": index,
        "verified": _verify_render(str(path), index, probe),
    }


def find_fonts(
    extra_roots: list[Path] | None = None,
    require_exists: bool = False,
) -> dict[str, object]:
    roots = [*(extra_roots or []), *DEFAULT_FONT_ROOTS]
    result = {
        "cjk": _resolve(CJK_CANDIDATES, roots, PROBE_CJK),
        "symbol": _resolve(SYMBOL_CANDIDATES, roots, PROBE_SYMBOL),
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


def register_with_reportlab(
    cjk_name: str = "Exam",
    symbol_name: str = "Shape",
    extra_roots: list[Path] | None = None,
) -> dict[str, str]:
    """向 reportlab 注册找到的字体，统一携带 subfontIndex，消除生成脚本里写死路径的隐患。

    生成脚本调用 register_with_reportlab() 后即可在样式中使用 'Exam'/'Shape'。
    """
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    fonts = find_fonts(extra_roots=extra_roots or [])
    cjk = fonts["cjk"]
    if not cjk["path"]:
        raise RuntimeError("未找到任何可用中文字体，请安装中文字体或扩充 CJK_CANDIDATES")
    pdfmetrics.registerFont(TTFont(cjk_name, cjk["path"], subfontIndex=cjk["index"] or 0))
    registered = {"cjk": cjk_name}
    symbol = fonts["symbol"]
    if symbol["path"]:
        pdfmetrics.registerFont(TTFont(symbol_name, symbol["path"], subfontIndex=symbol["index"] or 0))
        registered["symbol"] = symbol_name
    return registered


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
