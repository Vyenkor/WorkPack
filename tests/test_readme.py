from pathlib import Path
import json
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
README = (ROOT / "README.md").read_text(encoding="utf-8")
SCRIPTS = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["scripts"]


class ReadmeTest(unittest.TestCase):
    def test_documented_npm_scripts_exist(self):
        documented = set(re.findall(r"npm run ([\w:-]+)", README))
        self.assertTrue(documented)
        for script in documented | {"test", "start"}:
            with self.subTest(script=script):
                self.assertIn(script, SCRIPTS)

    def test_linked_files_exist(self):
        links = [link for link in re.findall(r"\]\(([^)#]+)\)", README) if "://" not in link]
        self.assertTrue(links)
        for link in links:
            with self.subTest(link=link):
                self.assertTrue((ROOT / link).is_file())

    def test_npm_test_runs_python_checks(self):
        runner = (ROOT / "scripts" / "test.cjs").read_text(encoding="utf-8")
        self.assertIn("'unittest', 'discover'", runner)
        self.assertIn("npm test` 会依次运行 Vitest 服务层测试和 `tests/test_*.py`", README)

    def test_covers_library_tasks_and_storage(self):
        for topic in ["文件库", "准备文件", "workpack-v3.sqlite", "设置 → 存储", ".workpack-project.json", "WORKPACK_TEST_DATA", "python3 -m unittest"]:
            with self.subTest(topic=topic):
                self.assertIn(topic, README)

    def test_landing_visuals_are_linked(self):
        self.assertIn("src/renderer/src/assets/workpack-logo.png", README)
        self.assertTrue((ROOT / "src/renderer/src/assets/workpack-logo.png").is_file())
        self.assertIn("prefers-color-scheme: dark", README)
        self.assertIn("docs/assets/workpack-logo-on-light.png", README)
        self.assertTrue((ROOT / "docs" / "assets" / "workpack-logo-on-light.png").is_file())
        for name in ("pending.png", "project-drawer.png", "checklist.png"):
            with self.subTest(name=name):
                self.assertNotIn(f"docs/assets/{name}", README)
        self.assertIn("social-preview.png", README)
        self.assertTrue((ROOT / "docs" / "assets" / "social-preview.png").is_file())
        for name in ("logo.png", "logo-dark.png", "logo.svg", "logo-dark.svg"):
            with self.subTest(removed=name):
                self.assertNotIn(f"docs/assets/{name}", README)
                self.assertFalse((ROOT / "docs" / "assets" / name).exists())


if __name__ == "__main__":
    unittest.main()
