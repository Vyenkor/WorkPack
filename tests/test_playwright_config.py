from pathlib import Path
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
CONFIG = (ROOT / "playwright.config.ts").read_text(encoding="utf-8")


class PlaywrightConfigTest(unittest.TestCase):
    def test_only_spec_files_are_matched(self):
        self.assertIn("testDir: './tests'", CONFIG)
        self.assertIn("testMatch: '*.spec.ts'", CONFIG)

    @unittest.skipUnless(shutil.which("npx"), "需要 npx")
    def test_playwright_does_not_load_vitest_files(self):
        result = subprocess.run(
            ["npx", "playwright", "test", "--list"],
            cwd=ROOT, capture_output=True, text=True, timeout=60, check=False,
        )
        output = result.stdout + result.stderr
        self.assertEqual(result.returncode, 0, output)
        self.assertIn("ui-accessibility.spec.ts", output)
        self.assertNotIn("service.test.ts", output)
        self.assertNotIn("Vitest cannot be imported", output)


if __name__ == "__main__":
    unittest.main()
