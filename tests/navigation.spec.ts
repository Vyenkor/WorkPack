import { _electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let app: ElectronApplication
let page: Page
let root: string

test.beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-navigation-'))
  app = await _electron.launch({
    executablePath: require('electron'), args: ['.'],
    env: { ...process.env, WORKPACK_TEST_DATA: path.join(root, 'data') }
  })
  page = await app.firstWindow()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1050, 700))
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible()
})

test.afterEach(async () => {
  await app?.close()
  const resolved = path.resolve(root)
  if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('workpack-navigation-')) {
    fs.rmSync(resolved, { recursive: true, force: true })
  }
})

function nav(name: string) {
  return page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true })
}
function tools() { return page.getByRole('navigation', { name: '页面导航' }) }
function back() { return tools().getByRole('button', { name: '返回上一步' }) }
function forward() { return tools().getByRole('button', { name: '前进一步' }) }

test('toolbar stays available when collapsed and follows page navigation branches', async ({}, info) => {
  await expect(tools().getByRole('button')).toHaveCount(3)
  await expect(back()).toBeDisabled()
  await expect(forward()).toBeDisabled()
  const brand = (await page.locator('.brand').boundingBox())!
  const toolRow = (await tools().boundingBox())!
  const workspace = (await page.locator('.workspace-control').boundingBox())!
  expect(toolRow.y).toBeGreaterThanOrEqual(brand.y + brand.height)
  expect(toolRow.y + toolRow.height).toBeLessThanOrEqual(workspace.y)

  await nav('项目').click()
  await page.getByRole('searchbox', { name: '搜索项目', exact: true }).fill('保留筛选')
  await nav('文件库').click()
  await back().click()
  await expect(page.getByRole('heading', { name: '项目', exact: true })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: '搜索项目', exact: true })).toHaveValue('保留筛选')
  await expect(forward()).toBeEnabled()
  await page.keyboard.press('Alt+ArrowLeft')
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible()
  await expect(back()).toBeDisabled()
  await page.keyboard.press('Alt+ArrowRight')
  await expect(page.getByRole('heading', { name: '项目', exact: true })).toBeVisible()
  await nav('待处理').click()
  await expect(forward()).toBeDisabled()
  await nav('待处理').click()

  const expandedWidth = await page.locator('.view').evaluate(element => element.clientWidth)
  await tools().getByRole('button', { name: '折叠侧栏' }).click()
  await expect(page.locator('.sidebar')).toBeHidden()
  await expect(tools().getByRole('button', { name: '展开侧栏' })).toHaveAttribute('aria-expanded', 'false')
  expect(await page.locator('.view').evaluate(element => element.clientWidth)).toBeGreaterThan(expandedWidth)
  const row = (await tools().boundingBox())!
  const breadcrumb = (await page.locator('.breadcrumb').boundingBox())!
  expect(row.x + row.width).toBeLessThanOrEqual(breadcrumb.x)
  await back().click()
  await expect(page.getByRole('heading', { name: '项目', exact: true })).toBeVisible()
  await forward().click()
  await expect(page.getByRole('heading', { name: '待处理', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('collapsed.png'), scale: 'css' })
  await tools().getByRole('button', { name: '展开侧栏' }).click()
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(nav('待处理')).toHaveAttribute('aria-current', 'page')
  await page.screenshot({ path: info.outputPath('expanded.png'), scale: 'css' })
})

test('navigation restores specific projects, skips deleted projects and protects an open form', async () => {
  const parent = path.join(root, 'projects')
  fs.mkdirSync(parent)
  await app.evaluate(({ dialog }, folder) => {
    Object.defineProperty(dialog, 'showOpenDialog', {
      configurable: true, value: async () => ({ canceled: false, filePaths: [folder] })
    })
  }, parent)
  await page.evaluate(() => window.workpack.chooseStorageLocation('project'))
  for (const name of ['项目甲', '项目乙']) {
    await nav('项目').click()
    await page.getByRole('button', { name: '新建项目', exact: true }).click()
    await page.getByRole('textbox', { name: '项目名称', exact: true }).fill(name)
    await page.keyboard.press('Alt+ArrowLeft')
    await expect(page.getByRole('textbox', { name: '项目名称', exact: true })).toHaveValue(name)
    await page.getByRole('textbox', { name: '客户名称', exact: true }).fill('演示客户')
    await page.getByRole('textbox', { name: '负责人', exact: true }).fill('测试负责人')
    await page.locator('.modal-card button[type="submit"]').click()
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  }
  await nav('文件库').click()
  await back().click()
  await expect(page.getByRole('heading', { name: '项目乙', exact: true })).toBeVisible()
  await back().click()
  await expect(page.getByRole('heading', { name: '项目', exact: true })).toBeVisible()
  await back().click()
  await expect(page.getByRole('heading', { name: '项目甲', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '项目操作', exact: true }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: '删除项目', exact: true }).click()
  await expect(page.getByRole('heading', { name: '项目', exact: true })).toBeVisible()
  await expect(page.locator('.project-card')).toHaveCount(1)
  await back().click()
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible()
  await forward().click()
  await expect(page.getByRole('heading', { name: '项目', exact: true })).toBeVisible()
  await expect(page.locator('.project-card')).toHaveCount(1)
  await expect(forward()).toBeDisabled()
})
