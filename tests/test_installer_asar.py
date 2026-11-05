"""Exercise the installer checker with both ASAR path conventions."""
import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
HARNESS = r"""
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')[process.argv[1]]
const scenario = process.argv[2]
const entries = {
  'out/main/index.js': 'main',
  'out/preload/index.js': 'preload',
  'out/renderer/assets/index.js': 'renderer',
  'out/renderer/assets/index.css': 'styles'
}
if (scenario === 'missing') delete entries['out/preload/index.js']
if (scenario === 'obsolete') entries['out/renderer/assets/index.js'] = 'workpack.sqlite'
const header = { files: {} }
for (const [file, content] of Object.entries(entries)) {
  const parts = file.split('/')
  let node = header
  for (const part of parts.slice(0, -1)) node = node.files[part] ??= { files: {} }
  node.files[parts.at(-1)] = { content }
}
const extracted = []
const asar = {
  listPackage: () => Object.keys(entries).map(file => path.join('/', file)),
  extractFile: (_archive, file) => {
    // @electron/asar 3.4.1 traverses dirname(file).split(path.sep).
    let node = header
    for (const dir of path.dirname(file).split(path.sep)) {
      if (dir !== '.') node = node?.files?.[dir]
    }
    const entry = node?.files?.[path.basename(file)]
    if (!entry) throw new Error(`"${file}" was not found in this archive`)
    extracted.push(file)
    return Buffer.from(entry.content)
  }
}
const context = {
  require: name => {
    if (name === 'node:fs') return { existsSync: () => true }
    if (name === 'node:path') return path
    if (name === '@electron/asar') return asar
    throw new Error(`Unexpected module: ${name}`)
  },
  process: { argv: ['node', 'checker', 'fixture.asar'] },
  console: { log: () => {} }
}
const run = () => vm.runInNewContext(fs.readFileSync('scripts/check-installer-asar.cjs', 'utf8'), context)
if (scenario === 'missing') assert.throws(run, /安装包缺少 out\/preload\/index.js/)
else if (scenario === 'obsolete') assert.throws(run, /仍包含已删除内容：workpack.sqlite/)
else {
  run()
  assert.equal(extracted.length, 4)
  assert.deepEqual(extracted, Object.keys(entries).map(file => path.normalize(file)))
}
"""


class InstallerAsarTests(unittest.TestCase):
    def test_platform_paths_and_validation(self):
        for platform in ('posix', 'win32'):
            for scenario in ('clean', 'missing', 'obsolete'):
                with self.subTest(platform=platform, scenario=scenario):
                    result = subprocess.run(
                        ['node', '-e', HARNESS, platform, scenario],
                        cwd=ROOT, capture_output=True, text=True,
                    )
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == '__main__':
    unittest.main()
