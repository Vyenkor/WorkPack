import { _electron, expect, test } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const electronExecutable = require('electron') as string

test('pending filters match the custom checklist model', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-pending-'))
  const projects = path.join(root, 'projects')
  fs.mkdirSync(projects)
  const application = await _electron.launch({ executablePath: electronExecutable, args: ['.'], env: { ...process.env, WORKPACK_TEST_DATA: path.join(root, 'data') } })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: '让工作，有条不紊。' })).toBeVisible()
    await application.evaluate(({ dialog }, folder) => {
      Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [folder] }) })
    }, projects)
    await page.getByRole('button', { name: '我的工作空间' }).click()
    await page.getByRole('button', { name: '设置', exact: true }).click()
    await page.locator('.storage-row').first().getByRole('button', { name: '更改位置' }).click()
    const nav = page.getByRole('navigation', { name: '主导航' })
    await nav.getByRole('button', { name: '文件库' }).click()
    await page.getByRole('button', { name: '添加文件模板' }).click()
    await page.getByRole('textbox', { name: '文件名称' }).fill('签收表')
    await page.locator('.modal-card button[type="submit"]').click()
    await nav.getByRole('button', { name: '项目', exact: true }).click()
    await page.getByRole('button', { name: '新建项目' }).first().click()
    await page.getByRole('textbox', { name: '项目名称' }).fill('筛选甲')
    await page.getByRole('textbox', { name: '客户名称' }).fill('客户甲')
    await page.getByRole('textbox', { name: '负责人' }).fill('负责人甲')
    await page.locator('.modal-card button[type="submit"]').click()
    await page.getByRole('button', { name: '新建事项' }).first().click()
    await page.getByRole('textbox', { name: '事项名称' }).fill('第一批')
    await page.getByRole('textbox', { name: '经办人' }).fill('经办甲')
    await page.locator('.template-check input').first().check()
    await page.locator('.modal-card button[type="submit"]').click()
    await page.keyboard.press('Escape')
    await nav.getByRole('button', { name: /待处理/ }).click()
    await expect(page.locator('.pending-row')).toHaveCount(1)
    await page.getByRole('searchbox', { name: '搜索待处理' }).fill('不匹配')
    await expect(page.locator('.pending-row')).toHaveCount(0)
    await page.getByRole('button', { name: '清除' }).click()
    await expect(page.locator('.pending-row')).toHaveCount(1)
    await page.getByRole('combobox', { name: '客户' }).selectOption({ label: '客户甲' })
    await page.getByRole('combobox', { name: '经办人' }).selectOption({ label: '经办甲' })
    await expect(page.locator('.pending-row')).toHaveCount(1)
    await page.getByRole('group', { name: '完成状态', exact: true }).getByRole('button', { name: '已完成' }).click()
    await expect(page.locator('.pending-row')).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: '缺口' })).toHaveCount(0)
  } finally { await application.close(); fs.rmSync(root, { recursive: true, force: true }) }
})
