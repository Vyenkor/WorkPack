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

    def test_covers_purpose_data_and_workflow(self):
        for topic in ["准备、填写、签字、归档", "workpack.sqlite", ".workpack-project.json", "WORKPACK_TEST_DATA", "python3 -m unittest"]:
            with self.subTest(topic=topic):
                self.assertIn(topic, README)


if __name__ == "__main__":
    unittest.main()
