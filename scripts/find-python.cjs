const { spawnSync } = require('node:child_process')

const candidates = [['python3'], ['python'], ['py', '-3']]
const versionCheck = 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'

/** Returns the first interpreter that actually runs Python 3.9+ (tests use str.removesuffix), or null. */
module.exports = function findPython() {
  return candidates.find(([command, ...args]) => spawnSync(command, [...args, '-c', versionCheck]).status === 0) ?? null
}
