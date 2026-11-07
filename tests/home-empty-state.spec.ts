import { _electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let application: ElectronApplication
let page: Page
let root: string
test.beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-home-empty-'))
  application = await _electron.launch({ executablePath: require('electron'), args: ['.'], env: { ...process.env, WORKPACK_TEST_DATA: path.join(root, 'data') } })
  page = await application.firstWindow()
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible()
})
test.afterEach(async () => {
  await application?.close()
  const resolved = path.resolve(root)
  if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('workpack-home-empty-')) fs.rmSync(resolved, { recursive: true, force: true })
})

async function expectCompactHome() {
  await expect(page.locator('.attention-empty')).toHaveText('暂无待处理文件查看全部')
  expect((await page.locator('.attention-panel').boundingBox())!.height).toBeLessThanOrEqual(40)
  const attention = (await page.locator('.attention-panel').boundingBox())!
  const recent = (await page.locator('.recent-panel').boundingBox())!
  expect(recent.x).toBeCloseTo(attention.x, 3)
  expect(recent.width).toBeCloseTo(attention.width, 3)
  expect(recent.y).toBeGreaterThan(attention.y + attention.height)
  await expect(page.getByRole('heading', { name: '最近项目', exact: true })).toBeVisible()
}

test('no pending files use one compact row and recent projects below at every supported width', async ({}, info) => {
  for (const [width, height] of [[1050, 700], [1280, 800], [1600, 1000]]) {
    await application.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size as [number, number]), [width, height])
    await expectCompactHome()
    await expect(page.locator('.recent-panel .empty')).toContainText('还没有项目')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.screenshot({ path: info.outputPath('no-projects.png'), scale: 'css' })
  await page.locator('.attention-empty').getByRole('button', { name: '查看全部' }).click()
  await expect(page.getByRole('heading', { name: '待处理', exact: true })).toBeVisible()
})

test('a completed project gets the wide recent list, while pending work restores the original two columns', async ({}, info) => {
  const projects = path.join(root, 'projects')
  fs.mkdirSync(projects)
  const attachment = path.join(root, '交付清单.txt')
  fs.writeFileSync(attachment, 'WorkPack temporary UI fixture')
  await application.evaluate(({ dialog }, folder) => {
    Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [folder] }) })
  }, projects)
  const itemId = await page.evaluate(async () => {
    await window.workpack.chooseStorageLocation('project')
    await window.workpack.saveLibraryFile({ name: '交付清单', purpose: '' })
    const template = (await window.workpack.snapshot()).templates[0]
    const projectId = await window.workpack.saveProject({ name: '资料已完成的项目', customer: '示例客户', owner: '示例负责人', contact: '', note: '' })
    const eventId = await window.workpack.createLibraryEvent({ projectId, templateIds: [template.id], name: '资料交付', date: '2026-11-07', owner: '示例负责人' })
    return (await window.workpack.snapshot()).projects.find(project => project.id === projectId)!.events.find(event => event.id === eventId)!.items[0].id
  })
  await application.evaluate(({ dialog }, file) => {
    Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [file] }) })
  }, attachment)
  const taskId = await page.evaluate(async itemId => {
    await window.workpack.importAttachments(itemId)
    const task = (await window.workpack.snapshot()).projects[0].events[0].items[0].tasks[0]
    await window.workpack.setDocumentTaskDone({ id: task.id, done: true })
    return task.id
  }, itemId)
  await page.reload()
  await expectCompactHome()
  await expect(page.locator('.project-mini')).toHaveCount(1)
  const action = (await page.getByRole('button', { name: '新建项目', exact: true }).boundingBox())!
  await page.screenshot({ path: info.outputPath('completed-project.png'), scale: 'css' })
  await page.evaluate(id => window.workpack.setDocumentTaskDone({ id, done: false }), taskId)
  await page.reload()
  await expect(page.locator('.attention-empty')).toHaveCount(0)
  await expect(page.locator('.attention-row')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: '待处理文件', exact: true })).toBeVisible()
  const attention = (await page.locator('.attention-panel').boundingBox())!
  const recent = (await page.locator('.recent-panel').boundingBox())!
  expect(recent.x).toBeGreaterThan(attention.x + attention.width)
  expect(recent.y).toBeCloseTo(attention.y, 3)
  const pendingAction = (await page.getByRole('button', { name: '新建项目', exact: true }).boundingBox())!
  expect(pendingAction.x).toBeCloseTo(action.x, 3)
  expect(pendingAction.y).toBeCloseTo(action.y, 3)
  await page.screenshot({ path: info.outputPath('pending-unchanged.png'), scale: 'css' })
})
