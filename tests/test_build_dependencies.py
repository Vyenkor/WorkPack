"""Exercise the builder APIs affected by the minimatch security override."""
from pathlib import Path
import shutil
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


class BuildDependenciesTest(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "Node.js is needed for builder integration")
    def test_packaging_filters_and_asar_keep_their_compatible_glob_apis(self):
        result = subprocess.run(["node", "-e", r"""
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createRequire } = require('node:module')
const { FileMatcher } = require('app-builder-lib/out/fileMatcher')
const builder = createRequire(require.resolve('app-builder-lib'))
const universal = createRequire(builder.resolve('@electron/universal'))
for (const load of [builder, universal]) {
  const { minimatch } = load('minimatch')
  assert.equal(minimatch('目录/模板.txt', '*.txt', { matchBase: true }), true)
  assert.equal(minimatch('目录/模板.exe', '*.txt', { matchBase: true }), false)
}
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-builder-'))
;(async () => {
  try {
    const matcher = new FileMatcher(root, root, value => value, require('./package.json').build.files)
    const filter = matcher.createFilter()
    const file = { isDirectory: () => false }
    assert.equal(filter(path.join(root, 'out/renderer/index.html'), file), true)
    assert.equal(filter(path.join(root, 'package.json'), file), true)
    assert.equal(filter(path.join(root, 'Agent/Codex/UI改版交接说明.md'), file), false)
    assert.equal(filter(path.join(root, 'demo/index.html'), file), false)
    assert.equal(filter(path.join(root, 'node_modules/better-sqlite3/src/better_sqlite3.cpp'), file), false)
    const source = path.join(root, 'input')
    fs.mkdirSync(source)
    fs.writeFileSync(path.join(source, '中文.txt'), 'file content')
    const asar = builder('@electron/asar')
    const archive = path.join(root, 'test.asar')
    await asar.createPackage(source, archive)
    assert.equal(asar.extractFile(archive, '中文.txt').toString(), 'file content')
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})().catch(error => { console.error(error); process.exitCode = 1 })
"""], cwd=ROOT, capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
