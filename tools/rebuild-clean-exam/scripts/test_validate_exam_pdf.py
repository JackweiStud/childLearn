#!/usr/bin/env python3
"""rebuild-clean-exam 校验器与文档的回归测试。"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import unittest
import importlib.util
from pathlib import Path

import reportlab
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

import validate_exam_pdf as validator


SKILL_ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = SKILL_ROOT / "scripts" / "validate_exam_pdf.py"
OUTPUT_PATHS = SKILL_ROOT / "scripts" / "output_paths.py"
VERA_FONT = Path(reportlab.__file__).resolve().parent / "fonts" / "Vera.ttf"


class ValidateExamPdfTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        pdfmetrics.registerFont(TTFont("EmbeddedVera", str(VERA_FONT)))

    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

    def run_validator(self, pdf: Path, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(VALIDATOR), str(pdf), *args],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )

    def make_pdf(self, name: str, include_unembedded_font: bool) -> Path:
        path = self.root / name
        pdf = canvas.Canvas(str(path))
        if include_unembedded_font:
            pdf.setFont("Helvetica", 12)
            pdf.drawString(72, 760, "unembedded")
        pdf.setFont("EmbeddedVera", 12)
        pdf.drawString(72, 730, "embedded")
        pdf.save()
        return path

    def test_mixed_embedded_and_unembedded_fonts_fails(self) -> None:
        pdf = self.make_pdf("mixed-fonts.pdf", include_unembedded_font=True)

        result = self.run_validator(pdf, "--page-size", "any")

        self.assertEqual(1, result.returncode, result.stdout)
        self.assertIn("未嵌入字体", result.stdout)

    def test_declared_but_unused_unembedded_font_does_not_fail(self) -> None:
        pdf = self.make_pdf("embedded-only.pdf", include_unembedded_font=False)

        result = self.run_validator(pdf, "--page-size", "any")

        self.assertEqual(0, result.returncode, result.stdout)

    def test_font_restored_by_graphics_state_is_checked(self) -> None:
        path = self.root / "restored-font.pdf"
        pdf = canvas.Canvas(str(path))
        pdf.setFont("Helvetica", 12)
        pdf.saveState()
        pdf.setFont("EmbeddedVera", 12)
        pdf.drawString(72, 760, "embedded")
        pdf.restoreState()
        pdf.drawString(72, 730, "unembedded after restore")
        pdf.save()

        result = self.run_validator(path, "--page-size", "any")

        self.assertEqual(1, result.returncode, result.stdout)
        self.assertIn("/Helvetica", result.stdout)

    @unittest.skipUnless(shutil.which("pdftoppm"), "需要 pdftoppm")
    def test_render_uses_a_fresh_subdirectory(self) -> None:
        pdf = self.make_pdf("render.pdf", include_unembedded_font=False)
        render_base = self.root / "rendered"
        render_base.mkdir()
        stale_file = render_base / "page-999.png"
        stale_file.write_bytes(b"stale")

        rendered_files, run_dir = validator.render_pdf(pdf, render_base, 170)

        rendered = [Path(item) for item in rendered_files]
        self.assertEqual(1, len(rendered))
        self.assertEqual(run_dir, rendered[0].parent)
        self.assertNotEqual(render_base, run_dir)
        self.assertTrue(stale_file.exists())

    def test_text_extraction_report_warns_when_checks_have_no_text_layer(self) -> None:
        report = validator.text_extraction_report(["", None], checks_requested=True)

        self.assertEqual("", report["normalized"])
        self.assertEqual([1, 2], report["pages_without_text"])
        self.assertIn("无法从 PDF 文本层提取任何文字", report["warnings"][0])

    def test_docs_do_not_contain_current_exam_examples(self) -> None:
        content = "\n".join(
            [
                (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8"),
                (SKILL_ROOT / "references" / "layout-patterns.md").read_text(encoding="utf-8"),
            ]
        )

        for forbidden in ("--expected-pages 4", "综合素养通关", "120秒", "8490>□532"):
            self.assertNotIn(forbidden, content)

    def test_layout_example_calculates_column_width_dynamically(self) -> None:
        content = (SKILL_ROOT / "references" / "layout-patterns.md").read_text(encoding="utf-8")

        self.assertIn("available_width / len(items)", content)

    def test_default_pdf_output_path_is_relative_to_skill_root(self) -> None:
        self.assertTrue(OUTPUT_PATHS.is_file(), "缺少统一输出路径模块")
        spec = importlib.util.spec_from_file_location("output_paths", OUTPUT_PATHS)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        result = module.output_pdf_path("sample-exam.pdf")

        self.assertEqual(SKILL_ROOT / "outPdfFile" / "sample-exam.pdf", result)
        self.assertTrue(result.parent.is_dir())
        self.assertNotIn("/Users/jackwl", OUTPUT_PATHS.read_text(encoding="utf-8"))

    def test_skill_declares_project_relative_default_output_directory(self) -> None:
        content = (SKILL_ROOT / "SKILL.md").read_text(encoding="utf-8")

        self.assertIn("outPdfFile", content)
        self.assertIn("scripts/output_paths.py", content)
        self.assertNotIn("/Users/jackwl/Code/childLearn", content)


if __name__ == "__main__":
    unittest.main()
