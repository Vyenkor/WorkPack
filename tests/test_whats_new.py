from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "src" / "renderer" / "src" / "App.vue").read_text(encoding="utf-8")
STYLE = (ROOT / "src" / "renderer" / "src" / "style.css").read_text(encoding="utf-8")


class WhatsNewTest(unittest.TestCase):
    def test_workspace_menu_lists_only_this_release_changes(self):
        menu = APP.split('id="workspace-menu"', 1)[1].split('</aside>', 1)[0]
        self.assertIn("这次更新了什么", menu)
        for item in ("暖色界面与精简布局", "文件库新增搜索与分类筛选", "待处理默认显示未完成文件", "存储路径支持一键复制"):
            self.assertIn(f"<li>{item}</li>", menu)
        self.assertEqual(menu.count("<li>"), 4)
        self.assertIn('go(\'settings\')', menu)

    def test_popup_uses_existing_floating_surface_tokens(self):
        self.assertIn(".workspace-popover", STYLE)
        self.assertIn("box-shadow: var(--floating-shadow)", STYLE)
        self.assertIn("background: var(--color-surface)", STYLE)
        self.assertIn(".whats-new", STYLE)


if __name__ == "__main__":
    unittest.main()
