const fs = require('node:fs')
const path = require('node:path')
const { extractFile, listPackage } = require('@electron/asar')

const archive = process.argv[2]
if (!archive || !fs.existsSync(archive)) throw new Error('安装包缺少 app.asar')

const files = listPackage(archive).map(file => file.replace(/^[/\\]/, '').replaceAll('\\', '/'))
const required = ['out/main/index.js', 'out/preload/index.js']
for (const file of required) if (!files.includes(file)) throw new Error(`安装包缺少 ${file}`)

const runtime = files.filter(file => required.includes(file) || /^out\/renderer\/assets\/.*\.(js|css)$/.test(file))
const obsolete = ['workpack.sqlite', 'workpack:saveTemplate', 'workpack:createEvent', 'workpack:setStatus', 'RulesEditor', 'status-more', 'status-toggle', '流程']
for (const file of runtime) {
  // ASAR lookup splits directories using the host separator, unlike the checks above.
  const content = extractFile(archive, path.normalize(file)).toString('utf8')
  for (const term of obsolete) if (content.includes(term)) throw new Error(`${file} 仍包含已删除内容：${term}`)
}
console.log(`安装包运行文件检查通过（${runtime.length} 个文件）`)
