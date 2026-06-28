#!/usr/bin/env python3
"""Small image probing helpers for rebuild-clean-exam scripts."""

from __future__ import annotations

import hashlib
import struct
from pathlib import Path
from typing import BinaryIO


JPEG_START_OF_FRAME_MARKERS = {
    0xC0,
    0xC1,
    0xC2,
    0xC3,
    0xC5,
    0xC6,
    0xC7,
    0xC9,
    0xCA,
    0xCB,
    0xCD,
    0xCE,
    0xCF,
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _probe_png(handle: BinaryIO) -> tuple[int, int]:
    handle.seek(16)
    data = handle.read(8)
    if len(data) != 8:
        raise ValueError("PNG 文件头不完整")
    return struct.unpack(">II", data)


def _probe_jpeg(handle: BinaryIO) -> tuple[int, int]:
    handle.seek(2)
    while True:
        byte = handle.read(1)
        if not byte:
            break
        if byte != b"\xff":
            continue
        marker_byte = handle.read(1)
        while marker_byte == b"\xff":
            marker_byte = handle.read(1)
        if not marker_byte:
            break
        marker = marker_byte[0]
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        length_data = handle.read(2)
        if len(length_data) != 2:
            break
        length = struct.unpack(">H", length_data)[0]
        if length < 2:
            raise ValueError("JPEG 段长度无效")
        if marker in JPEG_START_OF_FRAME_MARKERS:
            data = handle.read(5)
            if len(data) != 5:
                break
            height, width = struct.unpack(">HH", data[1:5])
            return width, height
        handle.seek(length - 2, 1)
    raise ValueError("无法从 JPEG 读取尺寸")


def probe_image(path: Path) -> dict[str, object]:
    image = Path(path)
    if not image.is_file():
        raise FileNotFoundError(f"图片不存在：{image}")

    with image.open("rb") as handle:
        signature = handle.read(12)
        if signature.startswith(b"\x89PNG\r\n\x1a\n"):
            image_format = "png"
            width, height = _probe_png(handle)
        elif signature.startswith(b"\xff\xd8"):
            image_format = "jpeg"
            width, height = _probe_jpeg(handle)
        else:
            raise ValueError(f"不支持的图片格式：{image}")

    return {
        "path": str(image.resolve()),
        "filename": image.name,
        "format": image_format,
        "width_px": width,
        "height_px": height,
        "long_edge_px": max(width, height),
        "file_size_bytes": image.stat().st_size,
        "sha256": sha256_file(image),
    }
