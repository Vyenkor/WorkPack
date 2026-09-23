from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PLAN = ROOT / "技术方案_MVP.md"


class TechnicalPlanTest(unittest.TestCase):
    def test_plan_exists_and_covers_the_selected_local_stack(self):
        self.assertTrue(PLAN.is_file())
        content = PLAN.read_text(encoding="utf-8")

        for technology in [
            "Vue 3",
            "TypeScript",
            "Vite",
            "Element Plus",
            "Electron",
            "SQLite",
            "better-sqlite3",
            "electron-builder",
        ]:
            with self.subTest(technology=technology):
                self.assertIn(technology, content)

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
