from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "src" / "renderer" / "src" / "App.vue").read_text(encoding="utf-8")
STYLE = (ROOT / "src" / "renderer" / "src" / "style.css").read_text(encoding="utf-8")


class WhatsNewTest(unittest.TestCase):
    def test_workspace_menu_keeps_release_changes_in_news(self):
        menu = APP.split('id="workspace-menu"', 1)[1].split('</aside>', 1)[0]
        self.assertIn('v-if="!workspaceNews"', menu)
        self.assertIn('<span>News</span>', menu)
        self.assertIn('v-else class="whats-new"', menu)
        self.assertIn("最近更新", menu)
        for item in ("模板迁移支持中断后重试", "工作空间丢失时可重新定位", "修复文件进度与待办状态", "加快列表加载与文件操作"):
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
