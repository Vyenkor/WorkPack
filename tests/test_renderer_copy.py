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
