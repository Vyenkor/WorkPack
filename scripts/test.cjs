const { spawnSync } = require('node:child_process')
const electron = require('electron')

const vitest = spawnSync(electron, ['node_modules/vitest/vitest.mjs', 'run', 'tests/service.test.ts'], {
  stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
if (vitest.status !== 0) process.exit(vitest.status ?? 1)

const python = [['python3'], ['python'], ['py', '-3']].find(([command, ...args]) => spawnSync(command, [...args, '--version']).status === 0)
if (!python) {
  console.error('未找到 Python 3，无法运行 tests/test_*.py。请安装 Python 3 后重试。')
  process.exit(1)
}
const [command, ...args] = python
const unittest = spawnSync(command, [...args, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py'], { stdio: 'inherit' })
process.exit(unittest.status ?? 1)
