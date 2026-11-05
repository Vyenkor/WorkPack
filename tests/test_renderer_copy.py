from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "src" / "renderer" / "src" / "App.vue").read_text(encoding="utf-8")
CHECKLIST = (ROOT / "src" / "renderer" / "src" / "components" / "ItemChecklist.vue").read_text(encoding="utf-8")


class RendererCopyTest(unittest.TestCase):
    def test_library_and_event_selection_are_explicit(self):
        self.assertIn("templates: '文件库'", APP)
        self.assertIn('<h1>文件库</h1>', APP)
        self.assertIn('添加文件模板', APP)
        self.assertIn('新建分类', APP)
        self.assertIn('eventForm.templateIds', APP)
        self.assertIn('createLibraryEvent', APP)
        self.assertNotIn('适用流程', APP)

    def test_pending_page_filters_cover_relevant_dimensions(self):
        for label in ("全部项目", "全部客户", "全部经办人", "事项经办人", "全部完成状态", "没有符合条件的待处理项"):
            self.assertIn(label, APP)
        self.assertNotIn('aria-label="流程"', APP)
        self.assertNotIn('流程已删除', APP)
        self.assertNotIn('v-model="pendingFilter.gap"', APP)
        self.assertIn("matchesPendingQuery", APP)
        self.assertIn("cachedProjectPercent", APP)
        self.assertIn("clearPendingFilters", APP)
        self.assertIn("pending-filters", APP)

    def test_back_buttons_use_the_shared_linear_icon(self):
        self.assertIn('<UiIcon name="back" class="back-icon" />', APP)
        self.assertNotIn('>← 项目</button>', APP)
        self.assertNotIn('>← 返回事项</button>', APP)

    def test_saved_project_is_opened_by_id(self):
        self.assertIn("projects.find(item => item.id === saved)", APP)
        self.assertNotIn("projects.find(item => item.name === name)", APP)

    def test_checklist_uses_custom_checkboxes(self):
        self.assertIn('class="document-task"', CHECKLIST)
        self.assertIn('type="checkbox"', CHECKLIST)
        self.assertIn('添加待办', CHECKLIST)
        self.assertIn('item.attachments.some(file => file.exists)', CHECKLIST)
        self.assertNotIn('status-more', CHECKLIST)

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

    def test_workspace_move_explains_the_kept_database(self):
        self.assertIn("workpack-v3.sqlite", APP)
        self.assertIn("迁回原目录前", APP)
        self.assertIn("-wal", APP)
        self.assertIn("-shm", APP)

    def test_keeps_operational_copy_and_short_actions(self):
        self.assertIn('每份文件都有独立的待办清单。', APP)
        self.assertIn('新文件默认包含“准备文件”待办。', APP)
        self.assertIn('>编辑</button>', CHECKLIST)
        self.assertIn('>删除</button>', CHECKLIST)


if __name__ == "__main__":
    unittest.main()
