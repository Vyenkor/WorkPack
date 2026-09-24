from pathlib import Path
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")
FAKE_PYTHON2 = """#!/bin/sh
echo "Python 2.7.18" >&2
case "$1" in --version) exit 0 ;; *) exit 1 ;; esac
"""


@unittest.skipUnless(NODE and os.name != "nt", "需要 Node.js 和类 Unix shell")
class FindPythonTest(unittest.TestCase):
    def find_with(self, executables):
        with tempfile.TemporaryDirectory() as directory:
            for name, content in executables.items():
                path = Path(directory) / name
                path.write_text(content)
                path.chmod(0o755)
            result = subprocess.run(
                [NODE, "-e", "process.stdout.write(JSON.stringify(require('./scripts/find-python.cjs')()))"],
                cwd=ROOT, env={"PATH": directory}, capture_output=True, text=True, check=True,
            )
        return json.loads(result.stdout)

    def test_rejects_python2_even_though_version_flag_succeeds(self):
        self.assertIsNone(self.find_with({"python3": FAKE_PYTHON2}))

    def test_skips_python2_and_uses_next_python3(self):
        real = f'#!/bin/sh\nexec "{sys.executable}" "$@"\n'
        self.assertEqual(self.find_with({"python3": FAKE_PYTHON2, "python": real}), ["python"])

    def test_returns_null_when_no_interpreter_exists(self):
        self.assertIsNone(self.find_with({}))


if __name__ == "__main__":
    unittest.main()
