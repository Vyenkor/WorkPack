from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "src" / "renderer" / "src" / "App.vue").read_text(encoding="utf-8")
STYLE = (ROOT / "src" / "renderer" / "src" / "style.css").read_text(encoding="utf-8")
DESIGN = (ROOT / "DESIGN.md").read_text(encoding="utf-8")


def css_block(selector):
    match = re.search(rf"(?m)^{re.escape(selector)}\s*\{{([^}}]*)\}}", STYLE)
    if match is None:
        raise AssertionError(selector)
    return match.group(1)


class EventDrawerTest(unittest.TestCase):
    def test_design_marks_the_drawer_as_implemented(self):
        patterns = DESIGN.split("## Interaction Patterns\n", 1)[1].split("\n## ", 1)[0]
        self.assertIn("**侧边抽屉**（已实现）", patterns)
        self.assertNotIn("**侧边抽屉**（规划）", patterns)
        self.assertIn("720px", patterns)
        self.assertIn("在工作台、项目详情或待处理页就地打开", patterns)
        self.assertIn("Tab 在抽屉内循环", patterns)
        self.assertIn("有未保存修改时，关闭前需要确认", patterns)

    def test_project_page_keeps_the_event_list_and_reuses_the_checklist(self):
        project = APP.split('class="page-section project-detail"', 1)[1].split('class="event-drawer"', 1)[0]
        drawer = APP.split('class="event-drawer"', 1)[1].split('class="modal-backdrop"', 1)[0]
        self.assertNotIn("activeEventOnly", APP)
        self.assertNotIn("<ItemChecklist", project)
        self.assertIn('class="event-list-section"', project)
        self.assertIn("<ItemChecklist", drawer)
        self.assertIn('aria-modal="true"', drawer)
        self.assertIn('aria-labelledby="event-drawer-title"', drawer)
        self.assertIn("@keydown=\"handleDrawerKeydown\"", drawer)
        self.assertIn("@click=\"requestCloseDrawer\"", drawer)
        self.assertNotIn("每份文件都有独立的待办清单。", drawer)
        self.assertIn('class="drawer-scrim"', APP)
        self.assertIn("view.value === 'pending'", APP)
        self.assertIn("openEvent(target.project, target.event, { projectPage: true })", APP)
        self.assertIn('@click="openEvent(row.project, row.event)"', APP)
        self.assertIn("closeDrawer(true)", APP)
        self.assertIn("restoreDrawerFocus", APP)

    def test_drawer_is_a_720px_overlay_with_the_floating_shadow(self):
        drawer = css_block(".event-drawer")
        self.assertIn("width: 720px", drawer)
        self.assertIn("var(--floating-shadow)", drawer)
        self.assertIn("var(--color-hairline)", drawer)
        self.assertIn("var(--color-surface)", drawer)
        self.assertNotIn("box-shadow", css_block(".event-detail"))
        self.assertIn("var(--color-overlay)", css_block(".drawer-scrim"))
        self.assertLess(int(re.search(r"z-index:\s*(\d+)", css_block(".drawer-scrim")).group(1)), int(re.search(r"z-index:\s*(\d+)", drawer).group(1)))
        self.assertLess(int(re.search(r"z-index:\s*(\d+)", drawer).group(1)), int(re.search(r"z-index:\s*(\d+)", css_block(".modal-backdrop")).group(1)))


if __name__ == "__main__":
    unittest.main()
