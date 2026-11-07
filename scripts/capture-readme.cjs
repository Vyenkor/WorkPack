// Capture real Electron screens with disposable example data.
const { _electron, expect } = require('@playwright/test')
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const repo = path.resolve(__dirname, '..')
const artifactBase = path.join(repo, 'Agent', 'Codex', 'artifacts')
fs.mkdirSync(artifactBase, { recursive: true })
const fixture = fs.mkdtempSync(path.join(artifactBase, 'readme-fixtures-'))
const projects = path.join(fixture, 'projects')
const originals = path.join(fixture, 'originals')
for (const folder of [projects, originals]) fs.mkdirSync(folder)
const output = path.join(repo, 'docs', 'assets')
const xml = value => value.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char])

// Minimal, valid DOCX fixtures, rather than renamed text files.
function zip(entries) {
  const local = [], central = []
  let offset = 0
  for (const [name, content] of Object.entries(entries)) {
    const filename = Buffer.from(name)
    const source = Buffer.from(content)
    const data = zlib.deflateRawSync(source)
    const crc = zlib.crc32(source)
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(8, 8)
    header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(source.length, 22); header.writeUInt16LE(filename.length, 26)
    const directory = Buffer.alloc(46)
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(8, 10)
    directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(source.length, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42)
    local.push(header, filename, data); central.push(directory, filename)
    offset += header.length + filename.length + data.length
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(entries).length, 8); end.writeUInt16LE(Object.keys(entries).length, 10)
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, directory, end])
}

const templates = [
  { name: '合同签署确认单', category: '交付资料', purpose: '记录合同资料复核与签署情况' },
  { name: '设备交付清单', category: '交付资料', purpose: '核对设备、附件及随附资料' },
  { name: '到货验收记录', category: '验收资料', purpose: '记录到货检查及验收结论' },
  { name: '培训签到表', category: '培训资料', purpose: '记录培训参与人员及完成情况' },
  { name: '项目归档清单', category: '交付资料', purpose: '检查项目资料是否齐全' }
]
function writeFixtureDocuments() {
  for (const template of templates) {
    fs.writeFileSync(path.join(originals, template.name + '.docx'), zip({
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml': `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${xml(template.name)}</w:t></w:r></w:p><w:p><w:r><w:t>WorkPack 演示资料 · 2026年11月7日</w:t></w:r></w:p><w:p><w:r><w:t>${xml(template.purpose)}</w:t></w:r></w:p></w:body></w:document>`
    }))
  }
}

let application
async function picker(file) {
  await application.evaluate(({ dialog }, file) => {
    Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [file] }) })
  }, file)
}

async function capture() {
  writeFixtureDocuments()
  application = await _electron.launch({ executablePath: require('electron'), args: ['.'], cwd: repo, env: { ...process.env, WORKPACK_TEST_DATA: path.join(fixture, 'data') } })
  const page = await application.firstWindow()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1440, 900))
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible()
  await picker(projects)
  await page.evaluate(() => window.workpack.chooseStorageLocation('project'))
  for (const category of ['交付资料', '验收资料', '培训资料']) await page.evaluate(name => window.workpack.saveLibraryCategory({ name }), category)
  for (const template of templates) {
    const id = await page.evaluate(async template => {
      const category = (await window.workpack.snapshot()).categories.find(category => category.name === template.category)
      await window.workpack.saveLibraryFile({ name: template.name, purpose: template.purpose, categoryId: category.id })
      return (await window.workpack.snapshot()).templates.find(file => file.name === template.name).id
    }, template)
    await picker(path.join(originals, template.name + '.docx'))
    await page.evaluate(id => window.workpack.importLibraryFile(id), id)
  }
  const examples = [
    { name: '云岚科技 · 设备交付', customer: '云岚科技', owner: '林舟', note: '设备资料已齐，等待客户签收。', event: '设备出库与交付', date: '2026-11-06', files: [0, 1, 4], done: [3, 2, 1] },
    { name: '青禾实验室 · 工作站验收', customer: '青禾实验室', owner: '陈星', note: '按验收清单逐项准备现场资料。', event: '现场验收资料', date: '2026-11-07', files: [1, 2], done: [3, 1] },
    { name: '启辰教育 · 培训交付', customer: '启辰教育', owner: '周宁', note: '培训及资料交接已完成。', event: '培训与归档', date: '2026-11-05', files: [3, 4], done: [4, 4] },
    { name: '星河制造 · 售后维护', customer: '星河制造', owner: '林舟', note: '整理点检记录与维护交接资料。', event: '季度点检资料', date: '2026-11-04', files: [2, 4], done: [1, 2] }
  ]
  await page.evaluate(async ({ examples, templates }) => {
    const library = (await window.workpack.snapshot()).templates
    for (const example of examples) {
      const projectId = await window.workpack.saveProject({ name: example.name, customer: example.customer, owner: example.owner, contact: '', note: example.note })
      const eventId = await window.workpack.createLibraryEvent({ projectId, templateIds: example.files.map(index => library.find(file => file.name === templates[index].name).id), name: example.event, date: example.date, owner: example.owner })
      const items = (await window.workpack.snapshot()).projects.find(project => project.id === projectId).events.find(event => event.id === eventId).items
      for (const item of items) {
        for (const name of ['资料复核', '签字确认', '归档']) await window.workpack.saveDocumentTask({ itemId: item.id, name })
        const refreshed = (await window.workpack.snapshot()).projects.find(project => project.id === projectId).events.find(event => event.id === eventId).items.find(file => file.id === item.id)
        const index = example.files.findIndex(index => templates[index].name === item.name)
        for (const task of refreshed.tasks.slice(0, example.done[index])) await window.workpack.setDocumentTaskDone({ id: task.id, done: true })
      }
    }
  }, { examples, templates })
  await page.reload()
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.project-mini')).toHaveCount(4)
  await expect(page.locator('.attention-row')).toHaveCount(5)
  await page.screenshot({ path: path.join(output, 'workbench.png'), scale: 'css' })
  const nav = name => page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true })
  await nav('项目').click()
  await expect(page.locator('.project-card')).toHaveCount(4)
  await page.screenshot({ path: path.join(output, 'projects.png'), scale: 'css' })
  await page.getByRole('button', { name: /云岚科技 · 设备交付/ }).first().click()
  await page.locator('.event-card').first().click()
  await expect(page.locator('.event-drawer .document-card')).toHaveCount(3)
  await page.screenshot({ path: path.join(output, 'project-drawer.png'), scale: 'css' })
  await page.keyboard.press('Escape')
  await nav('待处理').click()
  await expect(page.locator('.pending-row')).toHaveCount(7)
  await page.screenshot({ path: path.join(output, 'pending.png'), scale: 'css' })
  await nav('文件库').click()
  await expect(page.locator('.library-table tbody tr')).toHaveCount(5)
  await page.screenshot({ path: path.join(output, 'library.png'), scale: 'css' })
  expect(errors).toEqual([])
  return { projects: 4, events: 4, templates: 5, items: 9, screenshots: ['workbench.png', 'projects.png', 'project-drawer.png', 'pending.png', 'library.png'] }
}

async function main() {
  try { console.log(JSON.stringify(await capture())) }
  finally {
    if (application) await application.close()
    const resolved = fs.realpathSync(fixture), base = fs.realpathSync(artifactBase), relative = path.relative(base, resolved)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !path.basename(resolved).startsWith('readme-fixtures-')) throw new Error('Refusing to clean an unexpected fixture path')
    fs.rmSync(resolved, { recursive: true, force: true })
    console.log('Temporary example projects, database and files removed.')
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
