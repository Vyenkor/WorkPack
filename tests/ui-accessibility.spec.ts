import { _electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const electronExecutable = require('electron') as string

let application: ElectronApplication
let page: Page
let testRoot: string

async function contrastRatio(page: Page, selector: string) {
  return page.locator(selector).first().evaluate(node => {
    const channels = (value: string) => value.match(/[\d.]+/g)!.map(Number)
    const foreground = channels(getComputedStyle(node).color)
    let backgroundNode: Element | null = node
    let background = [255, 255, 255]
    while (backgroundNode) {
      const color = channels(getComputedStyle(backgroundNode).backgroundColor)
      if (color.length === 3 || color[3] === 1) { background = color; break }
      backgroundNode = backgroundNode.parentElement
    }
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map(value => {
      const component = value / 255
      return component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
    const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
    return (light + 0.05) / (dark + 0.05)
  })
}

test.beforeEach(async () => {
  testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-ui-'))
  application = await _electron.launch({ executablePath: electronExecutable, args: ['.'], env: { ...process.env, WORKPACK_TEST_DATA: path.join(testRoot, 'data') } })
  page = await application.firstWindow()
  await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible()
})

test.afterEach(async () => {
  await application?.close()
  if (testRoot && path.resolve(testRoot).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(testRoot).startsWith('workpack-ui-')) {
    fs.rmSync(testRoot, { recursive: true, force: true })
  }
})

test('text, focus, and persistent error feedback follow the design rules', async () => {
  await page.getByRole('button', { name: '新建项目' }).first().click()
  const name = page.getByRole('textbox', { name: '项目名称' })
  await expect(name).toBeFocused()
  await name.fill('界面检查')
  await page.getByRole('textbox', { name: '客户名称' }).fill('测试客户')
  await page.getByRole('textbox', { name: '负责人' }).fill('测试负责人')
  await page.locator('.modal-card button[type="submit"]').click()
  const error = page.getByRole('alert')
  await expect(error).toContainText('请先选择项目上级文件夹')
  await page.waitForTimeout(3500)
  await expect(error).toBeVisible()
  await error.getByRole('button', { name: '关闭错误提示' }).click()
  await expect(error).toHaveCount(0)
  const sizes = await page.locator('.modal-card').evaluate(card => Array.from(card.querySelectorAll<HTMLElement>('*'))
    .filter(node => node.textContent?.trim() && node.children.length === 0 && getComputedStyle(node).display !== 'none')
    .map(node => Number.parseFloat(getComputedStyle(node).fontSize)))
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12)
  for (const selector of ['.nav button.active', '.top-avatar', '.form-help', '.form-grid > label', '.modal-card .button.primary', '.modal-card .button.secondary']) {
    expect(await contrastRatio(page, selector), selector).toBeGreaterThanOrEqual(4.5)
  }
})

test('prepared status needs an attachment and other steps toggle by click', async ({}, testInfo) => {
  const parent = path.join(testRoot, 'projects')
  fs.mkdirSync(parent)
  await application.evaluate(({ dialog }, folder) => {
    Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [folder] }) })
  }, parent)
  await page.getByRole('button', { name: '新建项目' }).first().click()
  await page.getByRole('textbox', { name: '项目名称' }).fill('状态检查')
  await page.getByRole('textbox', { name: '客户名称' }).fill('测试客户')
  await page.getByRole('textbox', { name: '负责人' }).fill('测试负责人')
  await page.locator('.template-check input').first().check()
  await page.getByRole('button', { name: '选择文件夹' }).click()
  await expect(page.locator('.selected-path')).toContainText(parent)
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: '状态检查' })).toBeVisible()
  await page.getByRole('button', { name: '新建事项' }).first().click()
  await page.getByRole('textbox', { name: '事项名称' }).fill('第一批交付')
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: '第一批交付' })).toBeVisible()
  const firstItem = page.locator('.checklist tbody tr').first()
  await expect(firstItem).toBeVisible()
  const prepared = firstItem.getByRole('button', { name: /准备状态/ })
  await expect(prepared).toBeDisabled()
  await expect(prepared.locator('..')).toHaveAttribute('title', '请先上传文件')
  const filled = firstItem.getByRole('button', { name: /填写状态/ })
  await filled.click()
  await expect(firstItem.getByRole('button', { name: /填写状态/ })).toContainText('已填写')
  await firstItem.getByRole('combobox', { name: /填写更多状态/ }).selectOption('na')
  await expect(firstItem.getByRole('button', { name: /填写状态/ })).toContainText('不适用')
  for (const selector of ['.project-overview-grid span', '.status-toggle.pending', '.status-toggle.na', '.tag.orange']) {
    expect(await contrastRatio(page, selector), selector).toBeGreaterThanOrEqual(4.5)
  }
  await page.screenshot({ path: testInfo.outputPath('status.png'), fullPage: true })
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1050, 700))
  await expect(page.locator('.sidebar')).toHaveCSS('width', '216px')
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    tableScroll: document.querySelector('.table-wrap')!.scrollWidth > document.querySelector('.table-wrap')!.clientWidth
  }))
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewport)
  expect(layout.tableScroll).toBeTruthy()
  await page.screenshot({ path: testInfo.outputPath('minimum-window.png'), fullPage: false })
})
