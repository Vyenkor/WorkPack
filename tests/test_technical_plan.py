from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "Agent" / "Codex" / "产品规划" / "01_MVP基线"
PLAN = BASELINE / "技术方案_MVP.md"


class TechnicalPlanTest(unittest.TestCase):
    def test_planning_documents_have_valid_relative_links(self):
        planning = BASELINE.parent
        documents = list(planning.rglob("*.md"))
        self.assertTrue(documents)
        for document in documents:
            for link in re.findall(r"\]\(([^)#]+)\)", document.read_text(encoding="utf-8")):
                if "://" not in link:
                    with self.subTest(document=document.name, link=link):
                        self.assertTrue((document.parent / link).is_file())

    def test_plan_exists_and_covers_the_selected_local_stack(self):
        self.assertTrue(PLAN.is_file())
        content = PLAN.read_text(encoding="utf-8")

        for technology in [
            "Vue 3",
            "TypeScript",
            "Vite",
            "自有组件",
            "Electron",
            "SQLite",
            "better-sqlite3",
            "electron-builder",
        ]:
            with self.subTest(technology=technology):
                self.assertIn(technology, content)

    def test_current_documents_describe_library_tasks_instead_of_retired_workflows(self):
        product = (BASELINE / "产品设计文档_MVP.md").read_text(encoding="utf-8")
        technical = PLAN.read_text(encoding="utf-8")
        for content in (product, technical):
            self.assertIn("文件库", content)
            self.assertIn("自定义待办", content)
            self.assertIn("workpack-v3.sqlite", content)
            self.assertNotIn("选择流程", content)
            self.assertNotIn("不适用的步骤", content)

    def test_plan_covers_local_data_and_file_handling_boundaries(self):
        content = PLAN.read_text(encoding="utf-8")

        for topic in [
            "每台电脑独立保存",
            "上下文隔离",
            "清单快照",
            "项目文件夹被移动",
            "备份与恢复",
            "主要验证点",
        ]:
            with self.subTest(topic=topic):
                self.assertIn(topic, content)


if __name__ == "__main__":
    unittest.main()
