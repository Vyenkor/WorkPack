from pathlib import Path
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


if __name__ == "__main__":
    unittest.main()
