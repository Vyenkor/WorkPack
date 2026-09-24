from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "src" / "renderer" / "src" / "App.vue").read_text(encoding="utf-8")
CHECKLIST = (ROOT / "src" / "renderer" / "src" / "components" / "ItemChecklist.vue").read_text(encoding="utf-8")


class RendererCopyTest(unittest.TestCase):
    def test_template_library_is_presented_as_workflows(self):
        self.assertIn("templates: '流程'", APP)
        self.assertIn("<h1>流程</h1>", APP)
        self.assertIn("新建流程", APP)
        self.assertIn("编辑流程", APP)
        self.assertNotIn("<h1>模板</h1>", APP)

    def test_workflow_type_can_be_named_by_the_user(self):
        self.assertIn('v-model="templateTypeInput"', APP)
        self.assertNotIn('<label>事项类型<select', APP)

    def test_saved_project_is_opened_by_id(self):
        self.assertIn("projects.find(item => item.id === saved)", APP)
        self.assertNotIn("projects.find(item => item.name === name)", APP)

    def test_prepared_done_requires_available_attachment(self):
        self.assertIn('class="status-toggle"', CHECKLIST)
        self.assertIn("function canToggle", CHECKLIST)
        self.assertIn("item.states[step] === 'na'", CHECKLIST)
        self.assertIn("step !== 'prepared' || item.states[step] === 'done' || item.attachments.some(file => file.exists)", CHECKLIST)
        self.assertIn("'请先上传文件'", CHECKLIST)
        self.assertIn('<option value="na">不适用</option>', CHECKLIST)

    def test_not_applicable_status_does_not_toggle_to_done(self):
        self.assertIn("if (!canToggle(item, step)) return", CHECKLIST)
        self.assertIn("item.states[step] === 'done' ? 'pending' : 'done'", CHECKLIST)

    def test_error_toast_clears_on_the_next_action(self):
        self.assertIn("function clearToast()", APP)
        self.assertIn("clearToast()\n  view.value = next", APP)
        self.assertIn('@click="requestCloseModal"', APP)
        self.assertNotIn('@click="modal = null"', APP)
        self.assertIn("@click=\"clearToast\"", APP)

    def test_removes_redundant_page_and_card_copy(self):
        redundant = [
            "按项目查看事项与文件状态。",
            "进入事项可编辑清单、状态及附件。",
            "用于发货环节的资料归集和完成跟踪。",
            "创建一次发货、收货或培训事项，开始生成文件清单。",
        ]
        for phrase in redundant:
            self.assertNotIn(phrase, APP)

    def test_keeps_operational_copy_and_short_actions(self):
        self.assertIn("模板文件保存在本机数据目录", APP)
        self.assertIn("准备步骤需有文件。", APP)
        self.assertIn("未选步骤按“不适用”处理，不计入完成率。", (ROOT / "src" / "renderer" / "src" / "components" / "RulesEditor.vue").read_text(encoding="utf-8"))
        self.assertIn(">完成</button>", CHECKLIST)
        self.assertIn(">编辑</button>", CHECKLIST)
        self.assertIn(">删除</button>", CHECKLIST)


if __name__ == "__main__":
    unittest.main()
