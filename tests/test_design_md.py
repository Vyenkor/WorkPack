from pathlib import Path
import importlib.util
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
CONTENT = (ROOT / "DESIGN.md").read_text(encoding="utf-8")


def front_matter(text):
    return text.split("---\n", 2)[1]


def parse_front_matter(text):
    """Parses only nested `key: scalar` mappings so the test needs no YAML dependency.

    Lists, block scalars, flow collections and tabs raise instead of being misread.
    """
    root, stack = {}, [(-1, None)]
    for number, line in enumerate(front_matter(text).splitlines(), 2):
        if not line.strip():
            continue
        if "\t" in line or line.lstrip().startswith("- ") or ":" not in line:
            raise ValueError(f"DESIGN.md 第 {number} 行使用了测试解析器不支持的 YAML 写法：{line}")
        value = line.split(":", 1)[1].strip()
        if value[:1] in ("|", ">", "[", "{") and not value.startswith("{colors.") and not value.startswith('"'):
            raise ValueError(f"DESIGN.md 第 {number} 行使用了测试解析器不支持的 YAML 写法：{line}")
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


def is_hex(value):
    return re.fullmatch(r"#[0-9a-f]{6}", value) is not None


def luminance(hex_color):
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(first, second):
    light, dark = sorted((luminance(first), luminance(second)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


class DesignMdTest(unittest.TestCase):
    def test_colors_are_hex_values(self):
        for name, value in COLORS.items():
            with self.subTest(color=name):
                if name == "overlay":
                    self.assertRegex(value, r"^rgba\(\d+, \d+, \d+, 0?\.\d+\)$")
                else:
                    self.assertTrue(is_hex(value), value)

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

    def test_focus_and_control_boundaries_meet_non_text_contrast(self):
        for indicator in ("focus-ring", "control-border"):
            for background in ("surface", "canvas", "surface-subtle", "surface-hover", "sidebar"):
                with self.subTest(indicator=indicator, background=background):
                    self.assertGreaterEqual(contrast(COLORS[indicator], COLORS[background]), 3)

    def test_palette_matches_linear_light_direction(self):
        self.assertEqual(COLORS["primary"], "#505bc7")
        self.assertEqual(COLORS["canvas"], "#ededee")
        self.assertNotEqual(COLORS["primary"], COLORS["status-done"])
        colors = CONTENT.split("## Colors\n", 1)[1].split("\n## Typography\n", 1)[0]
        for phrase in ("蓝紫色", "status-done", "primary-soft", "surface-hover"):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, colors)

    def test_shell_uses_one_rounded_work_surface(self):
        self.assertEqual(TOKENS["rounded"]["shell"], "12px")
        layout = CONTENT.split("### 一级布局\n", 1)[1].split("\n### ", 1)[0]
        for phrase in ("Level 0", "Level 1", "rounded.shell", "单一浅色工作面板", "Level 2"):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, layout)

    def test_navigation_toolbar_and_emblem_have_separate_positions(self):
        self.assertIn("src/renderer/src/assets/workpack-logo.png", CONTENT)
        self.assertIn("工具始终与顶栏当前位置文字垂直居中对齐", CONTENT)
        self.assertIn("左右外边距均为 8px", CONTENT)
        self.assertIn("左下角单独显示", CONTENT)

    def test_library_identity_uses_one_shared_visual_treatment(self):
        self.assertIn("使用文件图标及主色区分模板文件", CONTENT)

    def test_typography_uses_linear_variable_font_and_system_fallbacks(self):
        typography = CONTENT.split("## Typography\n", 1)[1].split("\n## Layout\n", 1)[0]
        for family in ("Inter Variable", "SF Pro Display", "Segoe UI", "CJK"):
            with self.subTest(family=family):
                self.assertIn(family, typography)
        self.assertRegex(typography, r"12\s*px")
        self.assertIn("中文保留默认字距", typography)

    def test_layout_rules_for_dense_desktop(self):
        layout = CONTENT.split("## Layout\n", 1)[1].split("\n## Elevation & Depth\n", 1)[0]
        structure = layout.split("### 页面结构\n", 1)[1].split("\n### ", 1)[0]
        spacing = layout.split("### 间距\n", 1)[1].split("\n### ", 1)[0]
        toolbar = layout.split("### 工具栏\n", 1)[1].split("\n### ", 1)[0]
        rows = layout.split("### 行高与垂直密度\n", 1)[1].split("\n### ", 1)[0]
        priority = layout.split("### 主次信息\n", 1)[1].split("\n### ", 1)[0]

        for marker in ("44px", "1050px", "192px", "232px"):
            with self.subTest(marker=marker):
                self.assertIn(marker, structure)
        self.assertRegex(spacing, r"4\s*px")
        for token in ("xs", "sm", "md", "lg", "xl", "xxl"):
            with self.subTest(token=token):
                self.assertIn(token, spacing)
        self.assertIn("空状态", spacing)
        for control in ("页面标题", "搜索", "筛选", "排序", "主要操作"):
            with self.subTest(control=control):
                self.assertIn(control, toolbar)
        self.assertIn("34px", toolbar)
        self.assertIn("换行", toolbar)
        self.assertIn("48px", rows)
        self.assertIn("46px", rows)
        self.assertIn("垂直空间", rows)
        for term in ("项目和文件名称", "状态", "进度", "用户录入的备注"):
            with self.subTest(term=term):
                self.assertIn(term, priority)
        self.assertLess(priority.index("文件名称"), priority.index("状态"))
        self.assertNotIn("密度适中", CONTENT)

    def test_documents_required_sections(self):
        for section in ["Overview", "Colors", "Typography", "Layout", "Elevation & Depth", "Shapes", "Components", "Interaction Patterns", "Content & Copy", "Do's and Don'ts", "Responsive Behavior", "Agent Prompt Guide", "Iteration Guide", "Known Gaps"]:
            with self.subTest(section=section):
                self.assertRegex(CONTENT, rf"(?m)^## {re.escape(section)}$")

    def test_parser_matches_front_matter_shape(self):
        self.assertEqual(TOKENS["name"], "WorkPack")
        self.assertEqual(TOKENS["components"]["button-primary"]["backgroundColor"], "{colors.primary}")
        self.assertEqual(TOKENS["typography"]["body"]["fontSize"], "15px")

    def test_parser_rejects_unsupported_yaml(self):
        for snippet in ["colors:\n  - primary\n", "description: |\n  text\n", "colors: [a, b]\n"]:
            with self.subTest(snippet=snippet), self.assertRaises(ValueError):
                parse_front_matter(f"---\n{snippet}---\n")

    @unittest.skipUnless(importlib.util.find_spec("yaml"), "未安装 PyYAML")
    def test_parser_agrees_with_pyyaml(self):
        import yaml

        def as_strings(value):
            return {key: as_strings(item) for key, item in value.items()} if isinstance(value, dict) else str(value)

        self.assertEqual(as_strings(yaml.safe_load(front_matter(CONTENT))), TOKENS)


if __name__ == "__main__":
    unittest.main()
