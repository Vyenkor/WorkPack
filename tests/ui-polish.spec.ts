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
  await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible()
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

test('empty messages, plain breadcrumbs and selection feedback stay consistent across pages', async ({}, info) => {
  const selectedFill = 'rgb(225, 225, 226)'
  const hoveringFill = 'rgb(233, 233, 237)'
  for (const name of ['工作台', '项目', '待处理', '文件库']) {
    const selected = nav(name)
    await selected.click()
    await selected.hover()
    await expect(selected).toHaveAttribute('aria-current', 'page')
    await expect(selected).toHaveCSS('background-color', selectedFill)
    await expect(selected).toHaveCSS('font-weight', '500')
    const messages = page.locator('.empty h3, .empty > strong')
    expect(await messages.count()).toBeGreaterThan(0)
    for (const message of await messages.all()) {
      await expect(message).toHaveCSS('font-size', '13px')
      await expect(message).toHaveCSS('font-weight', '450')
      await expect(message).toHaveCSS('line-height', '19.5px')
    }
    await expect(page.locator('.breadcrumb')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expect(page.locator('.breadcrumb')).toHaveCSS('border-radius', '0px')
    await expect(page.locator('.breadcrumb-current')).toHaveText(name)
  }
  await expect(nav('工作台').locator('svg')).toHaveAttribute('data-icon', 'inbox')
  await expect(nav('项目').locator('svg')).toHaveAttribute('data-icon', 'cube')
  await expect(nav('文件库').locator('svg')).toHaveAttribute('data-icon', 'library')
  await expect(page.locator('.library-page .empty-icon')).toHaveAttribute('data-icon', 'library')
  const navigationFile = await nav('文件库').locator('svg path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))
  const emptyFile = await page.locator('.library-page .empty-icon path').evaluateAll(paths => paths.map(path => path.getAttribute('d')))
  expect(navigationFile).toEqual(emptyFile)
  await nav('项目').hover()
  await expect(nav('项目')).toHaveCSS('background-color', hoveringFill)
  await expect(nav('文件库')).toHaveCSS('background-color', selectedFill)
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('searchbox', { name: '搜索项目或客户' })).toBeFocused()
  await page.screenshot({ path: info.outputPath('library-empty-polish.png'), scale: 'css' })
  await nav('项目').click()
  await expect(page.locator('.projects-page .empty-icon')).toHaveAttribute('data-icon', 'cube')
  await nav('工作台').click()
  await expect(page.locator('.recent-panel .empty-icon')).toHaveAttribute('data-icon', 'cube')
  await page.screenshot({ path: info.outputPath('navigation-icons.png'), scale: 'css' })
})

test('search focus, aligned lists and dropdowns follow the compact desktop layout', async ({}, info) => {
  const navButtons = page.locator('.nav button')
  const navBox = await navButtons.evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height))
  for (const height of navBox) expect(height).toBeLessThanOrEqual(42)
  await clip('.nav', 'nav.png', info)

  await page.keyboard.press('Control+k')
  const search = page.getByRole('searchbox', { name: '搜索项目或客户' })
  await expect(search).toBeFocused()
  await expect(search).toHaveCSS('outline-style', 'none')
  await expect(page.locator('.global-search')).toHaveCSS('border-color', 'rgb(80, 91, 199)')
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
  await expect(recent).toHaveCSS('background-color', 'rgb(233, 233, 237)')
  await clip('.recent-panel', 'recent-hover.png', info)

  await nav('项目').click()
  const headerPositions = await page.locator('.project-columns > span').evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().left))
  const rowPositions = await page.locator('.project-card-main > span').evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().left))
  expect(rowPositions).toEqual(headerPositions.slice(0, -1))

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
  for (const [width, height] of [[1600, 1000], [1280, 800], [1050, 700]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size as [number, number]), [width, height])
    await nav('工作台').click()
    const anchor = (await page.getByRole('button', { name: '新建项目', exact: true }).boundingBox())!
    for (const destination of ['项目', 'detail', '文件库']) {
      if (destination === 'detail') await page.locator('.project-card-main').click()
      else await nav(destination).click()
      const action = page.getByRole('button', { name: destination === 'detail' ? '编辑项目' : destination === '文件库' ? '添加文件模板' : '新建项目', exact: true })
      const box = (await action.boundingBox())!
      expect(box.y).toBeCloseTo(anchor.y, 3)
      expect(box.x + box.width).toBeCloseTo(anchor.x + anchor.width, 3)
      expect(box.height).toBeCloseTo(34, 3)
      if (destination === 'detail') {
        const more = page.getByRole('button', { name: '项目操作', exact: true })
        const moreBox = (await more.boundingBox())!
        expect(moreBox.height).toBeCloseTo(box.height, 3)
        expect(moreBox.y).toBeCloseTo(box.y, 3)
        await expect(more).toHaveCSS('border-radius', '8px')
        await expect(page.locator('.project-overview-grid')).toHaveCSS('border-top-width', '0px')
        await expect(page.locator('.project-folder')).toHaveCSS('border-left-width', '0px')
        if (width === 1600) await page.screenshot({ path: info.outputPath('stable-project-header.png'), scale: 'css' })
      }
      if (destination === '文件库') {
        const controls = page.locator('.library-filters .filter-search, .category-filters button, .library-page .page-heading .button')
        for (const control of await controls.all()) {
          expect((await control.boundingBox())!.height).toBeCloseTo(34, 3)
          await expect(control).toHaveCSS('border-radius', '8px')
        }
        await expect(page.locator('.library-table th').first()).toHaveCSS('border-bottom-color', 'rgb(238, 238, 240)')
        if (width === 1600) await page.screenshot({ path: info.outputPath('aligned-library-controls.png'), scale: 'css' })
      }
    }
  }

})
