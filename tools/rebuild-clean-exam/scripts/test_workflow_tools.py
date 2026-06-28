#!/usr/bin/env python3
"""Workflow tool regression tests for rebuild-clean-exam."""

from __future__ import annotations

import importlib.util
import json
import struct
import tempfile
import unittest
import zlib
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = SKILL_ROOT / "scripts"


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_png(path: Path, width: int, height: int) -> None:
    raw = b"\x00" + (b"\xff\xff\xff" * width)
    payload = raw * height

    def chunk(kind: bytes, data: bytes) -> bytes:
        checksum = zlib.crc32(kind + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(payload))
        + chunk(b"IEND", b"")
    )


class WorkflowToolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def test_create_exam_model_records_source_image_facts(self) -> None:
        image = self.root / "page-1.png"
        write_png(image, 2400, 1800)
        output = self.root / "questions.json"
        module = load_module("exam_model", SCRIPTS / "exam_model.py")

        model = module.create_model([image], title="测试卷", output=output)

        self.assertTrue(output.is_file())
        saved = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(model, saved)
        self.assertEqual("rebuild-clean-exam.questions.v1", saved["schema"])
        self.assertEqual("测试卷", saved["title"])
        self.assertEqual(1, len(saved["pages"]))
        page = saved["pages"][0]
        self.assertEqual(1, page["page_number"])
        self.assertEqual(str(image.resolve()), page["source_image"]["path"])
        self.assertEqual(2400, page["source_image"]["width_px"])
        self.assertEqual(1800, page["source_image"]["height_px"])
        self.assertEqual("needs_transcription", page["status"])
        self.assertEqual([], page["questions"])
        self.assertEqual([], saved["ambiguities"])

    def test_find_font_returns_best_available_candidates(self) -> None:
        font_dir = self.root / "fonts"
        font_dir.mkdir()
        cjk = font_dir / "NotoSansCJK-Regular.ttc"
        symbol = font_dir / "Arial Unicode.ttf"
        cjk.write_bytes(b"fake")
        symbol.write_bytes(b"fake")
        module = load_module("find_font", SCRIPTS / "find_font.py")

        result = module.find_fonts(extra_roots=[font_dir], require_exists=True)

        self.assertEqual(str(cjk), result["cjk"]["path"])
        self.assertEqual(str(symbol), result["symbol"]["path"])
        self.assertEqual([], result["missing"])

    def test_preflight_warns_for_small_images_without_failing(self) -> None:
        image = self.root / "small.png"
        write_png(image, 1200, 900)
        font_dir = self.root / "fonts"
        font_dir.mkdir()
        (font_dir / "NotoSansCJK-Regular.ttc").write_bytes(b"fake")
        (font_dir / "Arial Unicode.ttf").write_bytes(b"fake")
        module = load_module("preflight", SCRIPTS / "preflight.py")

        result = module.run_preflight(
            [image],
            min_long_edge=2000,
            command_lookup=lambda command: f"/bin/{command}",
            module_lookup=lambda name: True,
            font_roots=[font_dir],
        )

        self.assertEqual("warning", result["status"])
        self.assertEqual([], result["issues"])
        self.assertEqual("low_resolution", result["images"][0]["status"])
        self.assertIn("小于建议值", result["warnings"][0])

    def test_preflight_can_fail_small_images_in_strict_mode(self) -> None:
        image = self.root / "small.png"
        write_png(image, 1200, 900)
        font_dir = self.root / "fonts"
        font_dir.mkdir()
        (font_dir / "NotoSansCJK-Regular.ttc").write_bytes(b"fake")
        (font_dir / "Arial Unicode.ttf").write_bytes(b"fake")
        module = load_module("preflight", SCRIPTS / "preflight.py")

        result = module.run_preflight(
            [image],
            min_long_edge=2000,
            strict_image_size=True,
            command_lookup=lambda command: f"/bin/{command}",
            module_lookup=lambda name: True,
            font_roots=[font_dir],
        )

        self.assertEqual("failed", result["status"])
        self.assertEqual("low_resolution", result["images"][0]["status"])
        self.assertIn("小于建议值", result["issues"][0])

    def test_preflight_still_fails_missing_runtime_tools(self) -> None:
        image = self.root / "page.png"
        write_png(image, 2400, 1800)
        module = load_module("preflight", SCRIPTS / "preflight.py")

        result = module.run_preflight(
            [image],
            command_lookup=lambda command: None,
            module_lookup=lambda name: False,
            font_roots=[self.root / "fonts"],
        )

        self.assertEqual("failed", result["status"])
        self.assertIn("pdftoppm", result["missing_commands"])
        self.assertIn("reportlab", result["missing_python_modules"])
        self.assertGreaterEqual(len(result["issues"]), 3)


if __name__ == "__main__":
    unittest.main()
