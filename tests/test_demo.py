from pathlib import Path
import json
import re
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / "demo"


class DemoTest(unittest.TestCase):
    def test_demo_assets_exist_and_are_linked(self):
        html = (DEMO / "index.html").read_text(encoding="utf-8")

        self.assertTrue((DEMO / "styles.css").is_file())
        self.assertTrue((DEMO / "app.js").is_file())
        self.assertIn('href="styles.css"', html)
        self.assertIn('src="app.js"', html)
        self.assertIn('id="view"', html)
        self.assertIn('id="modalRoot"', html)

    def test_demo_covers_the_agreed_mvp_flow(self):
        script = (DEMO / "app.js").read_text(encoding="utf-8")
        expected_flows = [
            "renderProjects",
            "renderProject",
            "renderPending",
            "renderTemplates",
            "openProjectModal",
            "openEventModal",
            "openEventDetail",
            "chooseProjectFolder",
            "createProjectFolder",
            "downloadTemplateAsset",
            "exportTemplateGroup",
            "文件清单状态已更新",
            "模拟上传",
        ]

        for flow in expected_flows:
            self.assertIn(flow, script)

    def test_demo_has_three_initial_business_templates(self):
        script = (DEMO / "app.js").read_text(encoding="utf-8")

        self.assertIn("shipping:", script)
        self.assertIn("receiving:", script)
        self.assertIn("training:", script)
        self.assertIn("发货资料模板", script)
        self.assertIn("收货资料模板", script)
        self.assertIn("培训资料模板", script)

    def test_project_folder_and_template_file_flow_are_visible(self):
        script = (DEMO / "app.js").read_text(encoding="utf-8")

        self.assertIn("选择上级文件夹", script)
        self.assertIn("导入项目的模板文件", script)
        self.assertIn("showDirectoryPicker", script)
        self.assertIn("getDirectoryHandle", script)
        self.assertIn("data-template-upload", script)
        self.assertIn("data-export-asset", script)

    @unittest.skipUnless(shutil.which("node"), "需要 Node.js")
    def test_escape_html_neutralizes_markup(self):
        script = (DEMO / "app.js").read_text(encoding="utf-8")
        source = re.search(r"function escapeHtml\(value\) \{.*?\n\}", script, re.S).group(0)
        payload = "<img src=x onerror=\"alert('x')\">&"
        result = subprocess.run(
            ["node", "-e", source + "\nprocess.stdout.write(JSON.stringify([escapeHtml(process.argv[1]), escapeHtml(null), escapeHtml(3)]))", payload],
            capture_output=True, text=True, check=True,
        )
        self.assertEqual(json.loads(result.stdout), ["&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;", "", "3"])

    def test_user_fields_in_html_strings_are_escaped(self):
        field = re.compile(r"\b(?:project|event|file|asset|pair\.event|pair\.project|item\.file|item\.project|item\.event)\.(?:name|customer|owner|contact|note|folder|attachment|code|size)\b")
        unescaped = []
        for number, line in enumerate((DEMO / "app.js").read_text(encoding="utf-8").splitlines(), 1):
            if "'<" not in line and ">'" not in line:
                continue
            for match in field.finditer(line):
                if line[match.end():].lstrip().startswith("?") or line.rfind("ownerSelect(", 0, match.start()) >= 0:
                    continue
                start = line.rfind("escapeHtml(", 0, match.start())
                between = line[start:match.start()] if start >= 0 else ""
                if start < 0 or between.count("(") <= between.count(")"):
                    unescaped.append(f"{number}: {match.group(0)}")
        self.assertEqual(unescaped, [])


if __name__ == "__main__":
    unittest.main()
