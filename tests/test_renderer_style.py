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

    def test_back_button_has_a_compact_hover_target(self):
        self.assertRegex(STYLE, r"\.back-button\s*\{[^}]*min-height: 28px[^}]*border: 1px solid transparent")
        self.assertIn(".back-button .back-icon", STYLE)

    def test_target_pages_use_spacing_tokens_for_layout(self):
        selectors = [
            ".stat-grid",
            ".stat-card",
            ".home-grid",
            ".attention-panel, .recent-panel",
            ".attention-row",
            ".project-mini",
            ".project-list",
            ".project-card-main",
            ".project-card-footer",
            ".filter-bar",
            ".pending-file",
            ".event-detail",
            ".event-detail-heading",
            ".event-progress-large",
            ".event-progress-large > span",
            ".event-actions",
            ".event-title",
            ".checklist-heading",
            ".checklist th",
            ".checklist td",
            ".tags",
            ".attachment-list",
            ".inline-actions",
        ]
        for selector in selectors:
            match = re.search(rf"(?m)^{re.escape(selector)}\s*\{{([^}}]*)\}}", REST)
            self.assertIsNotNone(match, selector)
            for declaration in re.findall(r"(?:gap|margin(?:-[a-z]+)?|padding(?:-[a-z]+)?)\s*:[^;]+", match.group(1)):
                value = re.sub(r"var\(--spacing-[a-z]+\)", "0", declaration)
                with self.subTest(selector=selector, declaration=declaration):
                    self.assertIsNone(re.search(r"\d+px", value))

    def test_top_level_selectors_are_not_overridden_later(self):
        selectors = re.findall(r"(?m)^([.#@][^{/][^{]*)\{", REST)
        duplicates = sorted({name.strip() for name in selectors if selectors.count(name) > 1})
        self.assertEqual(duplicates, [])


if __name__ == "__main__":
    unittest.main()
