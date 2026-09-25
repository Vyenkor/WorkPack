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

test('sidebar uses consistent outline icons at normal and minimum widths', async ({}, testInfo) => {
  const icons = page.locator('.nav button svg.nav-icon')
  await expect(icons).toHaveCount(4)
  expect(await icons.evaluateAll(nodes => new Set(nodes.map(node => node.innerHTML)).size)).toBe(4)
  for (const icon of await icons.all()) {
    await expect(icon).toHaveAttribute('aria-hidden', 'true')
    await expect(icon).toHaveAttribute('stroke', 'currentColor')
    await expect(icon).toHaveCSS('width', '20px')
    await expect(icon).toHaveCSS('height', '20px')
  }
  const active = page.locator('.nav button.active')
  const activeColors = await active.evaluate(button => ({ text: getComputedStyle(button).color, icon: getComputedStyle(button.querySelector('svg')!).color }))
  expect(activeColors.icon).toBe(activeColors.text)
  await page.screenshot({ path: testInfo.outputPath('sidebar-icons.png') })
  for (const label of ['项目', '待处理', '流程', '工作台']) {
    const button = page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: label, exact: true })
    await button.locator('svg').click()
    await expect(button).toHaveClass(/active/)
  }
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1050, 700))
  for (const icon of await icons.all()) await expect(icon).toHaveCSS('width', '20px')
})

test('page components use semantic outline icons', async ({}, testInfo) => {
  await expect(page.locator('.stat-card .stat-icon svg')).toHaveCount(4)
  await expect(page.locator('.home-grid .empty-icon svg')).toHaveCount(2)
  await expect(page.locator('.global-search svg.search-icon')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('home-component-icons.png') })

  await page.getByRole('button', { name: '新建项目' }).first().click()
  await expect(page.locator('.modal-close svg')).toHaveCount(1)
  const templateIcons = page.locator('.template-check .template-icon svg')
  await expect(templateIcons).toHaveCount(3)
  expect(await templateIcons.evaluateAll(nodes => new Set(nodes.map(node => node.innerHTML)).size)).toBe(1)
  for (const icon of await templateIcons.all()) {
    await expect(icon).toHaveCSS('width', '17px')
    await expect(icon).toHaveAttribute('stroke', 'currentColor')
  }
  await page.screenshot({ path: testInfo.outputPath('project-flow-icons.png') })
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1050, 700))
  const modalBounds = await page.locator('.modal-card').boundingBox()
  expect(modalBounds).not.toBeNull()
  expect(modalBounds!.x).toBeGreaterThanOrEqual(0)
  expect(modalBounds!.x + modalBounds!.width).toBeLessThanOrEqual(1050)
  await expect(templateIcons.first()).toHaveCSS('width', '17px')
  await page.locator('.modal-close').click()

  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '项目', exact: true }).click()
  await expect(page.locator('.project-list .empty-icon svg')).toHaveCount(1)
  await expect(page.locator('.filter-search svg.search-icon')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('projects-empty-icon.png') })

  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '待处理', exact: true }).click()
  await expect(page.locator('.pending-table .empty-icon svg')).toHaveCount(1)

  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '流程', exact: true }).click()
  await expect(page.locator('.notice-icon svg')).toHaveCount(1)
  await expect(page.locator('.notice-icon')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(page.locator('.template-card .more-button').first()).toContainText('编辑')
  const flowIcons = page.locator('.template-card .template-icon svg')
  await expect(flowIcons).toHaveCount(3)
  expect(await flowIcons.evaluateAll(nodes => new Set(nodes.map(node => node.innerHTML)).size)).toBe(1)
  await page.screenshot({ path: testInfo.outputPath('flow-component-icons.png') })

  await page.getByRole('button', { name: '新建流程' }).click()
  await expect(page.getByRole('heading', { name: '新建流程' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '流程名称' })).toBeVisible()
  await expect(page.getByText('事项类型')).toHaveCount(0)
  await page.getByRole('textbox', { name: '流程名称' }).fill('自定义流程')
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.locator('.template-card').filter({ hasText: '自定义流程' })).toBeVisible()
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
  await expect(error.locator('svg')).toHaveCount(2)
  await page.waitForTimeout(3500)
  await expect(error).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: '新建项目' }).first().click()
  await page.getByRole('textbox', { name: '项目名称' }).fill('关闭按钮检查')
  await page.getByRole('textbox', { name: '客户名称' }).fill('测试客户')
  await page.getByRole('textbox', { name: '负责人' }).fill('测试负责人')
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.getByRole('alert')).toContainText('请先选择项目上级文件夹')
  await page.getByRole('alert').getByRole('button', { name: '关闭错误提示' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
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
  await expect(page.locator('.project-detail .empty-icon svg')).toHaveCount(1)
  await page.getByRole('button', { name: '新建事项' }).first().click()
  await page.getByRole('textbox', { name: '事项名称' }).fill('第一批交付')
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: '第一批交付' })).toBeVisible()
  await expect(page.locator('.back-button .back-icon')).toHaveCount(2)
  expect((await page.locator('.back-button').allTextContents()).join('')).not.toContain('←')
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
  await expect(firstItem.getByRole('button', { name: /填写状态/ })).toBeDisabled()
  await firstItem.getByRole('button', { name: /填写状态/ }).click({ force: true })
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

test('navigation keeps a single active item and the create button stays enabled', async ({}, testInfo) => {
  const nav = page.getByRole('navigation', { name: '主导航' })
  const shot = path.join('/opt/cursor/artifacts/screenshots')
  fs.mkdirSync(shot, { recursive: true })
  async function expectOnly(label: string) {
    await expect(nav.locator('button.active')).toHaveCount(1)
    await expect(nav.locator('button.active')).toHaveText(new RegExp(`^${label}`))
  }
  async function snap(name: string) {
    await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'))
    await page.screenshot({ path: path.join(shot, name) })
  }
  async function resize(width: number) {
    await application.evaluate(({ BrowserWindow }, next) => BrowserWindow.getAllWindows()[0].setSize(next, 800), width)
  }

  await resize(1280)
  await expectOnly('工作台')
  async function expectFloatingShell(gutter: number) {
    const shell = await page.evaluate(() => {
      const radius = getComputedStyle(document.documentElement).getPropertyValue('--radius-shell').trim()
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect()
      const style = (selector: string) => getComputedStyle(document.querySelector(selector)!)
      const regions = ['.sidebar', '.topbar', '.view'].map(selector => ({
        radii: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map(key => style(selector)[key as 'borderTopLeftRadius']),
        fill: style(selector).backgroundColor,
        shadow: style(selector).boxShadow
      }))
      const sidebar = box('.sidebar'), topbar = box('.topbar'), main = box('.view')
      return {
        radius, regions, canvas: style('.app-shell').backgroundColor,
        gaps: {
          left: sidebar.left, top: sidebar.top, bottom: innerHeight - sidebar.bottom,
          between: topbar.left - sidebar.right, topbarTop: topbar.top,
          stack: main.top - topbar.bottom, right: innerWidth - main.right, mainBottom: innerHeight - main.bottom
        }
      }
    })
    for (const region of shell.regions) {
      expect(region.radii).toEqual([shell.radius, shell.radius, shell.radius, shell.radius])
      expect(region.fill).not.toBe(shell.canvas)
      expect(region.shadow).toBe('none')
    }
    for (const [side, value] of Object.entries(shell.gaps)) expect(Math.abs(value - gutter), side).toBeLessThanOrEqual(1)
  }
  await expectFloatingShell(16)
  await snap('home_1280.png')
  await resize(1050)
  await expectFloatingShell(8)
  await snap('home_1050.png')
  await resize(1280)
  await nav.getByRole('button', { name: '项目', exact: true }).click()
  await expectOnly('项目')
  await expect(page.getByRole('heading', { name: '项目', exact: true })).toBeVisible()
  const create = page.getByRole('button', { name: '新建项目' }).first()
  await expect(create).toBeEnabled()
  const primary = await create.evaluate(button => getComputedStyle(button).backgroundColor)
  expect(primary).toBe('rgb(61, 86, 116)')
  await nav.getByRole('button', { name: '待处理', exact: true }).hover()
  await expectOnly('项目')
  await snap('projects_empty_1280.png')
  await resize(1050)
  await snap('projects_empty_1050.png')
  await resize(1280)
  await nav.getByRole('button', { name: '待处理', exact: true }).click()
  await expectOnly('待处理')
  await snap('pending_empty_1280.png')
  await resize(1050)
  await snap('pending_empty_1050.png')
  await resize(1280)
  await nav.getByRole('button', { name: '流程', exact: true }).click()
  await expectOnly('流程')
  await nav.getByRole('button', { name: '工作台', exact: true }).click()
  await expectOnly('工作台')
  await nav.getByRole('button', { name: '项目', exact: true }).hover()
  await expectOnly('工作台')

  const parent = path.join(testRoot, 'projects')
  fs.mkdirSync(parent)
  await application.evaluate(({ dialog }, folder) => {
    Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [folder] }) })
  }, parent)
  await nav.getByRole('button', { name: '项目', exact: true }).click()
  await create.click()
  await page.getByRole('textbox', { name: '项目名称' }).fill('层级检查')
  await page.getByRole('textbox', { name: '客户名称' }).fill('测试客户')
  await page.getByRole('textbox', { name: '负责人' }).fill('测试负责人')
  await page.locator('.template-check input').first().check()
  await page.getByRole('button', { name: '选择文件夹' }).click()
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: '层级检查' })).toBeVisible()
  await expectOnly('项目')
  await page.getByRole('button', { name: '新建事项' }).first().click()
  await page.getByRole('textbox', { name: '事项名称' }).fill('第一批交付')
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: '第一批交付' })).toBeVisible()
  await expectOnly('项目')
  await page.getByRole('button', { name: '项目', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: '项目', exact: true })).toBeVisible()
  await expectOnly('项目')
  await snap('projects_1280.png')
  await resize(1050)
  await snap('projects_1050.png')
  await resize(1280)
  await nav.getByRole('button', { name: /待处理/ }).click()
  await expectOnly('待处理')
  await expect(page.locator('.pending-row').first()).toBeVisible()
  await snap('pending_1280.png')
  await resize(1050)
  await snap('pending_1050.png')
  await testInfo.attach('nav-checked', { body: 'ok', contentType: 'text/plain' })
})
