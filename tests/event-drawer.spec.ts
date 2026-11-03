import { _electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const electronExecutable = require('electron') as string

let application: ElectronApplication
let page: Page
let testRoot: string

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

async function createProjectWithEvent() {
  const parent = path.join(testRoot, 'projects')
  fs.mkdirSync(parent)
  await application.evaluate(({ dialog }, folder) => {
    Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [folder] }) })
  }, parent)
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '项目', exact: true }).click()
  await page.getByRole('button', { name: '新建项目' }).first().click()
  await page.getByRole('textbox', { name: '项目名称' }).fill('抽屉项目')
  await page.getByRole('textbox', { name: '客户名称' }).fill('测试客户')
  await page.getByRole('textbox', { name: '负责人' }).fill('测试负责人')
  await page.locator('.template-check input').first().check()
  await page.getByRole('button', { name: '选择文件夹' }).click()
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.locator('.project-detail h1')).toHaveText('抽屉项目')
  await page.getByRole('button', { name: '新建事项' }).first().click()
  await page.getByRole('textbox', { name: '事项名称' }).fill('第一批')
  await page.locator('.modal-card button[type="submit"]').click()
}

test('opening an event from the project page shows a drawer and stays on the project', async ({}, testInfo) => {
  await createProjectWithEvent()
  const drawer = page.locator('.event-drawer')
  await expect(drawer).toBeVisible()
  await expect(page.locator('.project-detail h1')).toHaveText('抽屉项目')
  await expect(page.locator('.project-detail .event-list-section')).toBeVisible()
  await expect(page.locator('.event-card')).toHaveCount(1)
  await expect(page.locator('.project-detail .event-detail')).toHaveCount(0)
  await expect(drawer.locator('.checklist')).toBeVisible()
  await expect(drawer.getByRole('button', { name: '上传' }).first()).toBeVisible()
  await expect(page.locator('.breadcrumb')).toContainText('抽屉项目')

  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'))
  const box = await drawer.boundingBox()
  const frame = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar')!.getBoundingClientRect()
    return { width: window.innerWidth, sidebarRight: sidebar.right }
  })
  expect(box).not.toBeNull()
  expect(Math.round(box!.width)).toBe(720)
  expect(Math.abs(box!.x + box!.width - frame.width)).toBeLessThanOrEqual(1)
  expect(box!.x).toBeGreaterThanOrEqual(frame.sidebarRight - 1)
  await expect(drawer).toHaveCSS('background-color', 'rgb(251, 252, 253)')
  await page.screenshot({ path: testInfo.outputPath('event-drawer-project.png') })
  const shadow = await drawer.evaluate(node => getComputedStyle(node).boxShadow)
  expect(shadow).not.toBe('none')
  expect(shadow).toContain('12px')
  expect(shadow).toContain('32px')

  await expect(drawer.locator('.back-button')).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect.poll(() => drawer.evaluate(root => {
    const elements = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    return root.contains(document.activeElement) && document.activeElement === elements[elements.length - 1]
  })).toBe(true)
  await page.keyboard.press('Tab')
  await expect(drawer.locator('.back-button')).toBeFocused()

  let confirmWhileClean = false
  const rejectConfirm = (dialog: { message: () => string; accept: () => Promise<void> }) => {
    confirmWhileClean = true
    return dialog.accept()
  }
  page.on('dialog', rejectConfirm)
  await page.keyboard.press('Escape')
  page.off('dialog', rejectConfirm)
  expect(confirmWhileClean).toBe(false)
  await expect(drawer).toHaveCount(0)
  await expect(page.locator('.project-detail h1')).toHaveText('抽屉项目')
  await expect(page.locator('.event-card')).toBeVisible()
  await expect(page.locator('.event-list-section')).toBeFocused()

  const card = page.locator('.event-card')
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('.back-button')).toBeFocused()
  await drawer.locator('.back-button').click()
  await expect(drawer).toHaveCount(0)
  await expect(card).toBeFocused()
  await expect(page.locator('.project-detail h1')).toHaveText('抽屉项目')

  const nav = page.getByRole('navigation', { name: '主导航' })
  await nav.getByRole('button', { name: /待处理/ }).click()
  await expect(page.locator('.content-shell h1')).toHaveText('待处理')
  const pendingRow = page.locator('.pending-row').first()
  await expect(pendingRow).toBeVisible()
  await pendingRow.focus()
  await page.keyboard.press('Enter')
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('.checklist')).toBeVisible()
  await expect(page.locator('.content-shell h1')).toHaveText('待处理')
  await expect(page.locator('.project-detail')).toHaveCount(0)
  await expect(nav.locator('button.active')).toHaveText(/待处理/)
  await page.screenshot({ path: testInfo.outputPath('event-drawer-pending.png') })

  await drawer.getByRole('button', { name: '添加文件项' }).click()
  const itemName = page.getByRole('textbox', { name: '文件名称' })
  await expect(itemName).toBeFocused()
  await itemName.fill('临时文件')
  page.once('dialog', dialog => {
    expect(dialog.message()).toContain('有未保存修改')
    return dialog.dismiss()
  })
  await page.keyboard.press('Escape')
  await expect(itemName).toBeFocused()
  await expect(page.locator('.modal-card')).toBeVisible()
  await expect(drawer).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await page.keyboard.press('Escape')
  await expect(page.locator('.modal-card')).toHaveCount(0)
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('.back-button')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(pendingRow).toBeFocused()
  await expect(page.locator('.content-shell h1')).toHaveText('待处理')
  await expect(page.locator('.project-detail')).toHaveCount(0)
})

test('top-bar search opens the project page, and deleting the opener focuses the neighbor', async () => {
  await createProjectWithEvent()
  const drawer = page.locator('.event-drawer')
  const nav = page.getByRole('navigation', { name: '主导航' })
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)

  await nav.getByRole('button', { name: /待处理/ }).click()
  await page.getByRole('searchbox', { name: '搜索待处理' }).fill('没有这个文件')
  await expect(page.getByRole('heading', { name: '没有符合条件的待处理项' })).toBeVisible()
  const globalSearch = page.locator('.global-search input')
  await globalSearch.fill('第一批')
  await globalSearch.press('Enter')
  await expect(page.locator('.project-detail h1')).toHaveText('抽屉项目')
  await expect(drawer).toBeVisible()
  await expect(nav.locator('button.active')).toHaveText(/^项目/)
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(page.locator('.project-detail h1')).toHaveText('抽屉项目')
  await expect(globalSearch).toBeFocused()
  await expect(page.locator('.content-shell h1')).toHaveText('抽屉项目')

  await page.getByRole('button', { name: '新建事项' }).first().click()
  await page.getByRole('textbox', { name: '事项名称' }).fill('第二批')
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(drawer.getByRole('heading', { name: '第二批' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.event-card')).toHaveCount(2)
  const cards = page.locator('.event-card')
  const keptName = ((await cards.nth(0).locator('h3').textContent()) ?? '').trim()
  await cards.nth(1).focus()
  await page.keyboard.press('Enter')
  await expect(drawer).toBeVisible()
  page.once('dialog', dialog => dialog.accept())
  await drawer.locator('.event-actions').getByRole('button', { name: '删除' }).click()
  await expect(drawer).toHaveCount(0)
  await expect(cards).toHaveCount(1)
  await expect(cards).toBeFocused()
  await expect(cards.locator('h3')).toHaveText(keptName)
})
