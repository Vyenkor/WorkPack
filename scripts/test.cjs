const { spawnSync } = require('node:child_process')
const electron = require('electron')
const result = spawnSync(electron, ['node_modules/vitest/vitest.mjs', 'run', 'tests/service.test.ts'], {
  stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
process.exit(result.status ?? 1)
