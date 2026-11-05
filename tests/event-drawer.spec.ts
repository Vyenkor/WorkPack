import { _electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const electronExecutable = require('electron') as string
let application: ElectronApplication
let page: Page
let root: string

test.beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-ui-'))
  application = await _electron.launch({ executablePath: electronExecutable, args: ['.'], env: { ...process.env, WORKPACK_TEST_DATA: path.join(root, 'data') } })
  page = await application.firstWindow()
  await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible()
})
test.afterEach(async () => {
  await application?.close()
  if (root && path.basename(root).startsWith('workpack-ui-')) fs.rmSync(root, { recursive: true, force: true })
})

async function createEvent() {
  const projects = path.join(root, 'projects')
  fs.mkdirSync(projects)
  await application.evaluate(({ dialog }, folder) => {
    Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [folder] }) })
  }, projects)
  await page.getByRole('button', { name: '我的工作空间' }).click()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.locator('.storage-row').first().getByRole('button', { name: '选择文件夹' }).click()
  await expect(page.locator('.storage-row').first()).toContainText(projects)

  const nav = page.getByRole('navigation', { name: '主导航' })
  await nav.getByRole('button', { name: '文件库' }).click()
  await page.getByRole('button', { name: '添加文件模板' }).click()
  await page.getByRole('textbox', { name: '文件名称' }).fill('发货清单')
  await page.getByRole('textbox', { name: '用途说明' }).fill('核对货物')
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.locator('.template-card')).toHaveCount(1)

  await nav.getByRole('button', { name: '项目', exact: true }).click()
  await page.getByRole('button', { name: '新建项目' }).first().click()
  await page.getByRole('textbox', { name: '项目名称' }).fill('抽屉项目')
  await page.getByRole('textbox', { name: '客户名称' }).fill('测试客户')
  await page.getByRole('textbox', { name: '负责人' }).fill('测试负责人')
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.locator('.project-detail h1')).toHaveText('抽屉项目')
  await page.getByRole('button', { name: '新建事项' }).first().click()
  await page.getByRole('textbox', { name: '事项名称' }).fill('第一批')
  await page.locator('.template-check input').first().check()
  await page.locator('.modal-card button[type="submit"]').click()
}

test('event drawer shows an independent checklist and keeps the project page', async () => {
  await createEvent()
  const drawer = page.locator('.event-drawer')
  await expect(drawer).toBeVisible()
  await expect(page.locator('.project-detail h1')).toHaveText('抽屉项目')
  await expect(drawer.locator('.document-card')).toHaveCount(1)
  const prepared = drawer.locator('.document-task input').first()
  await expect(prepared).toBeDisabled()
  await drawer.getByRole('button', { name: '添加待办' }).click()
  await page.getByRole('textbox', { name: '待办名称' }).fill('归档')
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(drawer.locator('.document-task')).toHaveCount(2)
  await drawer.locator('.document-task').nth(1).locator('input').check()
  await expect(drawer.locator('.document-task').nth(1).locator('input')).toBeChecked()
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(page.locator('.event-card')).toHaveCount(1)
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: /待处理/ }).click()
  await expect(page.locator('.pending-row')).toHaveCount(1)
  await page.locator('.pending-row').click()
  await expect(drawer).toBeVisible()
  await expect(page.locator('.content-shell h1')).toHaveText('待处理')
})

test('a matter remains editable after its last template item is removed', async () => {
  await createEvent()
  const drawer = page.locator('.event-drawer')
  await drawer.getByRole('button', { name: '添加文件项', exact: true }).click()
  await page.getByRole('textbox', { name: '文件名称' }).fill('补充说明')
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(drawer.locator('.document-card')).toHaveCount(2)
  page.on('dialog', dialog => dialog.accept())
  await drawer.locator('.document-card').first().getByRole('button', { name: '删除', exact: true }).click()
  await expect(drawer.locator('.document-card')).toHaveCount(1)
  for (const title of ['保留手动文件', '空事项']) {
    await drawer.locator('.event-actions').getByRole('button', { name: '编辑', exact: true }).click()
    await page.getByRole('textbox', { name: '事项名称' }).fill(title)
    await page.getByRole('textbox', { name: '经办人' }).fill('新经办人')
    await page.locator('.modal-card input[type="date"]').fill('2026-11-06')
    await page.locator('.modal-card button[type="submit"]').click()
    await expect(page.locator('.modal-card')).toHaveCount(0)
    await expect(drawer.locator('#event-drawer-title')).toHaveText(title)
    await expect(drawer).toContainText('新经办人')
    if (title === '保留手动文件') {
      await drawer.locator('.document-card').getByRole('button', { name: '删除', exact: true }).click()
      await expect(drawer.locator('.document-card')).toHaveCount(0)
    }
  }
})
