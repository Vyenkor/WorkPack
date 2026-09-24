from pathlib import Path
import colorsys
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
CONTENT = (ROOT / "DESIGN.md").read_text(encoding="utf-8")


def parse_front_matter(text):
    block = text.split("---\n", 2)[1]
    root, stack = {}, [(-1, None)]
    for line in block.splitlines():
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip())
        key, _, value = line.strip().partition(":")
        while stack[-1][0] >= indent:
            stack.pop()
        parent = stack[-1][1] if stack[-1][1] is not None else root
        value = value.strip().strip('"')
        if value:
            parent[key] = value
        else:
            parent[key] = {}
            stack.append((indent, parent[key]))
    return root


TOKENS = parse_front_matter(CONTENT)
COLORS = TOKENS["colors"]


def resolve(reference):
    group, name = reference.strip("{}").split(".")
    return TOKENS[group][name]


def luminance(hex_color):
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(first, second):
    light, dark = sorted((luminance(first), luminance(second)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


def hue_and_saturation(hex_color):
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    hue, _, saturation = colorsys.rgb_to_hls(r, g, b)
    return hue * 360, saturation


class DesignMdTest(unittest.TestCase):
    def test_colors_are_hex_values(self):
        for name, value in COLORS.items():
            with self.subTest(color=name):
                self.assertRegex(value, r"^#[0-9a-f]{6}$")

    def test_component_references_resolve(self):
        for component, properties in TOKENS["components"].items():
            for prop, value in properties.items():
                if value.startswith("{"):
                    with self.subTest(component=component, prop=prop):
                        resolve(value)

    def test_readable_text_is_at_least_12px(self):
        for name, style in TOKENS["typography"].items():
            with self.subTest(typography=name):
                self.assertGreaterEqual(int(style["fontSize"].removesuffix("px")), 12)

    def test_component_text_meets_wcag_aa(self):
        for component, properties in TOKENS["components"].items():
            if "textColor" in properties and "backgroundColor" in properties:
                with self.subTest(component=component):
                    self.assertGreaterEqual(contrast(resolve(properties["textColor"]), resolve(properties["backgroundColor"])), 4.5)

    def test_type_colors_do_not_reuse_status_hues(self):
        status_hues = [hue_and_saturation(COLORS[name])[0] for name in ("status-done", "status-pending")]
        for name in ("type-shipping", "type-receiving", "type-training", "type-custom"):
            hue, saturation = hue_and_saturation(COLORS[name])
            if saturation < 0.25:
                continue
            for status_hue in status_hues:
                with self.subTest(type=name, status_hue=status_hue):
                    self.assertGreater(min(abs(hue - status_hue), 360 - abs(hue - status_hue)), 25)

    def test_documents_required_sections(self):
        for section in ["Overview", "Colors", "Typography", "Layout", "Elevation & Depth", "Components", "Interaction Patterns", "Do's and Don'ts", "Responsive Behavior", "Agent Prompt Guide", "Known Gaps"]:
            with self.subTest(section=section):
                self.assertRegex(CONTENT, rf"(?m)^## {re.escape(section)}$")

    def test_parser_matches_front_matter_shape(self):
        self.assertEqual(TOKENS["name"], "WorkPack")
        self.assertEqual(TOKENS["components"]["button-primary"]["backgroundColor"], "{colors.primary}")
        self.assertEqual(TOKENS["typography"]["body"]["fontSize"], "14px")


if __name__ == "__main__":
    unittest.main()
