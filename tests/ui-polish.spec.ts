import { _electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let app: ElectronApplication
let page: Page
let root: string
test.beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-polish-'))
  app = await _electron.launch({ executablePath: require('electron'), args: ['.'], env: { ...process.env, WORKPACK_TEST_DATA: path.join(root, 'data') } })
  page = await app.firstWindow()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1600, 1000))
  await expect(page.getByRole('heading', { name: '让工作，有条不紊。' })).toBeVisible()
})
test.afterEach(async () => {
  await app?.close()
  const resolved = path.resolve(root)
  if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('workpack-polish-')) fs.rmSync(resolved, { recursive: true, force: true })
})
function nav(name: string) { return page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }) }
async function clip(selector: string, name: string, info: { outputPath: (name: string) => string }) {
  await page.waitForTimeout(250)
  await page.screenshot({ path: info.outputPath(name), clip: (await page.locator(selector).first().boundingBox())!, scale: 'css' })
}

test('search focus, list hover, compact nav and stats, and dropdowns follow the rounded layout', async ({}, info) => {
  const navButtons = page.locator('.nav button')
  const navBox = await navButtons.evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height))
  for (const height of navBox) expect(height).toBeLessThanOrEqual(42)
  await clip('.nav', 'nav.png', info)

  const statHeight = await page.locator('.stat-grid').evaluate(grid => grid.getBoundingClientRect().height)
  expect(statHeight).toBeLessThanOrEqual(72)
  await clip('.stat-grid', 'stats.png', info)

  await page.keyboard.press('Control+k')
  const search = page.getByRole('searchbox', { name: '搜索项目或客户' })
  await expect(search).toBeFocused()
  await expect(search).toHaveCSS('outline-style', 'none')
  await expect(page.locator('.global-search')).toHaveCSS('border-color', 'rgb(172, 69, 38)')
  await clip('.topbar', 'search-focus.png', info)

  const parent = path.join(root, 'projects'); fs.mkdirSync(parent)
  await app.evaluate(({ dialog }, file) => { Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [file] }) }) }, parent)
  await page.getByRole('button', { name: '我的工作空间' }).click(); await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.locator('.storage-row').first().getByRole('button', { name: '更改位置' }).click()
  await nav('项目').click(); await page.getByRole('button', { name: '新建项目' }).click()
  await page.getByRole('textbox', { name: '项目名称' }).fill('圆角检查')
  await page.getByRole('textbox', { name: '客户名称' }).fill('测试客户')
  await page.getByRole('textbox', { name: '负责人' }).fill('测试负责人')
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.locator('.project-overview-grid')).toBeVisible()
  expect(await page.locator('.project-overview-grid').evaluate(grid => grid.getBoundingClientRect().height)).toBeLessThanOrEqual(80)
  await clip('.project-overview-grid', 'project-overview.png', info)

  await nav('工作台').click()
  const recent = page.locator('.project-mini').first()
  await recent.hover()
  await expect(recent).toHaveCSS('border-top-left-radius', '8px')
  await expect(recent).toHaveCSS('background-color', 'rgb(236, 231, 223)')
  await clip('.recent-panel', 'recent-hover.png', info)

  await nav('待处理').click()
  const filter = page.locator('.pending-filters .filter-search input')
  await filter.click()
  await expect(filter).toHaveCSS('outline-style', 'none')
  await clip('.pending-filters', 'pending-search-focus.png', info)
  const projectSelect = page.getByRole('combobox', { name: '项目' })
  await expect(projectSelect).toHaveCSS('appearance', 'base-select')
  await projectSelect.click()
  const picker = await projectSelect.evaluate(select => ({ open: select.matches(':open'), radius: getComputedStyle(select, '::picker(select)').borderTopLeftRadius }))
  expect(picker).toEqual({ open: true, radius: '12px' })
  const view = (await page.locator('.view').boundingBox())!
  await page.waitForTimeout(250)
  await page.screenshot({ path: info.outputPath('select-open.png'), clip: { x: view.x, y: view.y, width: view.width, height: 420 }, scale: 'css' })
  await page.keyboard.press('Escape')
})
