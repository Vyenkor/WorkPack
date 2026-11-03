from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "ci.yml"
README = (ROOT / "README.md").read_text(encoding="utf-8")
LOCKFILE_NAMES = {
    "package-lock.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
}


class CiWorkflowTest(unittest.TestCase):
    def test_pull_requests_and_main_run_install_typecheck_and_tests(self):
        self.assertTrue(WORKFLOW.is_file())
        text = WORKFLOW.read_text(encoding="utf-8")

        self.assertIn("pull_request:", text)
        self.assertIn("push:", text)
        self.assertIn("- main", text)
        self.assertIn("runs-on: ubuntu-latest", text)
        self.assertIn("node-version: 26", text)
        for package in ["build-essential", "python3", "libatomic1"]:
            with self.subTest(package=package):
                self.assertIn(package, text)

        install = text.index("npm ci")
        typecheck = text.index("npm run typecheck")
        test = text.index("npm test")
        self.assertLess(install, typecheck)
        self.assertLess(typecheck, test)
        self.assertNotIn("test:e2e", text)
        self.assertNotIn("playwright", text.lower())
        self.assertNotIn("pnpm", text)

    def test_only_the_npm_lockfile_remains(self):
        present = sorted(path.name for path in ROOT.iterdir() if path.name in LOCKFILE_NAMES)
        self.assertEqual(present, ["package-lock.json"])
        self.assertNotIn("pnpm-lock.yaml", README)
        self.assertNotIn("pnpm-workspace.yaml", README)
        self.assertIn("package-lock.json", README)

    def test_readme_documents_the_ci_gate_and_leaves_e2e_local(self):
        self.assertIn(".github/workflows/ci.yml", README)
        self.assertIn("npm ci", README)
        self.assertIn("npm run typecheck", README)
        self.assertIn("npm test", README)
        self.assertIn("npm run test:e2e", README)
        self.assertIn("Node.js 26", README)


if __name__ == "__main__":
    unittest.main()
