from pathlib import Path
import json
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]
README = (ROOT / "README.md").read_text(encoding="utf-8")
GUIDE = (ROOT / "docs/DEVELOPMENT.md").read_text(encoding="utf-8")
USAGE = (ROOT / "docs/USAGE.md").read_text(encoding="utf-8")
SCRIPTS = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["scripts"]


class ReadmeTest(unittest.TestCase):
    def test_documented_npm_scripts_exist(self):
        documented = set(re.findall(r"npm run ([\w:-]+)", README + GUIDE))
        self.assertTrue(documented)
        for script in documented | {"test", "start"}:
            with self.subTest(script=script):
                self.assertIn(script, SCRIPTS)

    def test_linked_files_exist(self):
        for document in (ROOT / "README.md", ROOT / "docs/USAGE.md", ROOT / "docs/DEVELOPMENT.md"):
            links = [link for link in re.findall(r"\]\(([^)#]+)\)", document.read_text(encoding="utf-8")) if "://" not in link]
            for link in links:
                with self.subTest(document=document.name, link=link):
                    self.assertTrue((document.parent / link).is_file())
        self.assertIn("docs/USAGE.md", README)
        self.assertIn("docs/DEVELOPMENT.md", README)

    def test_ui_evidence_uses_ci_artifacts_without_broken_local_image_links(self):
        ignore = (ROOT / "Agent/Codex/.gitignore").read_text(encoding="utf-8")
        self.assertIn("/evidence/**/*.png", ignore)
        self.assertIn("docs/assets/workbench.png", README)
        report = ROOT / "Agent/Codex/UI改版验收记录.md"
        content = report.read_text(encoding="utf-8")
        self.assertIn("WorkPack-UI-evidence", content)
        for link in re.findall(r"\]\(([^)#]+)\)", content):
            if "://" not in link:
                self.assertTrue((report.parent / link).is_file(), link)

    def test_npm_test_runs_python_checks(self):
        runner = (ROOT / "scripts" / "test.cjs").read_text(encoding="utf-8")
        self.assertIn("'unittest', 'discover'", runner)
        self.assertIn("npm test", GUIDE)
        self.assertIn("Vitest", GUIDE)
        self.assertIn("unittest", GUIDE)

    def test_covers_library_tasks_and_storage(self):
        for topic in ["文件库", "准备文件", "设置 → 存储", "数据保存在本机"]:
            with self.subTest(topic=topic):
                self.assertIn(topic, README)
        for topic in ["workpack-v3.sqlite", ".workpack-project.json", "删除业务事项", "备份前退出"]:
            self.assertIn(topic, USAGE)
        for topic in ["WORKPACK_TEST_DATA", "python3 -m unittest"]:
            self.assertIn(topic, GUIDE)

    def test_landing_visuals_are_linked(self):
        self.assertIn("src/renderer/src/assets/workpack-logo.png", README)
        self.assertTrue((ROOT / "src/renderer/src/assets/workpack-logo.png").is_file())
        self.assertIn("prefers-color-scheme: dark", README)
        self.assertIn("docs/assets/workpack-logo-on-light.png", README)
        self.assertTrue((ROOT / "docs" / "assets" / "workpack-logo-on-light.png").is_file())
        for name in ("workbench.png", "projects.png", "pending.png", "project-drawer.png", "library.png"):
            with self.subTest(name=name):
                self.assertIn(f"docs/assets/{name}", README)
                png = (ROOT / "docs/assets" / name).read_bytes()
                self.assertEqual(png[:8], b"\x89PNG\r\n\x1a\n")
                self.assertEqual(int.from_bytes(png[16:20], "big"), 1440)
                self.assertEqual(int.from_bytes(png[20:24], "big"), 900)
        self.assertIn("实际运行截图", README)
        self.assertIn("已清理演示数据", README)
        self.assertIn("social-preview.png", GUIDE)
        self.assertTrue((ROOT / "docs" / "assets" / "social-preview.png").is_file())
        for name in ("logo.png", "logo-dark.png", "logo.svg", "logo-dark.svg"):
            with self.subTest(removed=name):
                self.assertNotIn(f"docs/assets/{name}", README)
                self.assertFalse((ROOT / "docs" / "assets" / name).exists())

    def test_capture_fixture_is_isolated_and_cleaned(self):
        capture = (ROOT / "scripts/capture-readme.cjs").read_text(encoding="utf-8")
        for required in ("WORKPACK_TEST_DATA", "readme-fixtures-", "fs.realpathSync", "relative.startsWith('..')", "finally", "await application.close()", "fs.rmSync(resolved"):
            self.assertIn(required, capture)
        artifacts = ROOT / "Agent/Codex/artifacts"
        self.assertEqual(list(artifacts.glob("readme-fixtures-*")), [])


if __name__ == "__main__":
    unittest.main()
