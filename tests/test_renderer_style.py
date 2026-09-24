from pathlib import Path
import re
import unittest

from test_design_md import TOKENS


STYLE = (Path(__file__).resolve().parents[1] / "src" / "renderer" / "src" / "style.css").read_text(encoding="utf-8")
ROOT, REST = STYLE.split("}\n", 1)


class RendererStyleTest(unittest.TestCase):
    def test_css_colors_match_design_tokens(self):
        for name, color in TOKENS["colors"].items():
            with self.subTest(color=name):
                self.assertIn(f"--color-{name}: {color};", ROOT)
        self.assertNotRegex(REST, r"#[0-9a-fA-F]{3,8}\b|rgba?\(")

    def test_css_font_sizes_match_design_tokens(self):
        for name, typography in TOKENS["typography"].items():
            with self.subTest(typography=name):
                self.assertIn(f"--font-{name}: {typography['fontSize']};", ROOT)
        self.assertNotRegex(REST, r"font-size:\s*(?:[1-9]|1[01])px\b")

    def test_focus_and_status_styles_use_readable_design_colors(self):
        self.assertIn("outline: 3px solid var(--color-focus-ring)", STYLE)
        self.assertIn("border-color: var(--color-control-border)", STYLE)
        self.assertRegex(STYLE, r"\.template-icon, \.event-type-icon\s*\{[^}]*--color-primary")
        for status in ("done", "pending", "na"):
            with self.subTest(status=status):
                self.assertRegex(STYLE, rf"\.status-toggle\.{status}\s*\{{[^}}]*--color-status-{status}[^}}]*--color-status-{status}-soft")

    def test_panels_do_not_cast_shadows_or_move_on_hover(self):
        self.assertNotRegex(STYLE, r"\.panel\s*\{[^}]*box-shadow")
        self.assertNotRegex(STYLE, r"\.(?:project-card|event-card):hover\s*\{[^}]*transform")

    def test_top_level_selectors_are_not_overridden_later(self):
        selectors = re.findall(r"(?m)^([.#@][^{/][^{]*)\{", REST)
        duplicates = sorted({name.strip() for name in selectors if selectors.count(name) > 1})
        self.assertEqual(duplicates, [])


if __name__ == "__main__":
    unittest.main()
