import { _electron, expect, test } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const electronExecutable = require('electron') as string

test('navigation, workspace menu, and storage settings follow the desktop layout', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-accessibility-'))
  const application = await _electron.launch({ executablePath: electronExecutable, args: ['.'], env: { ...process.env, WORKPACK_TEST_DATA: path.join(root, 'data') } })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible()
    const nav = page.getByRole('navigation', { name: '主导航' })
    await expect(nav.locator('button')).toHaveCount(4)
    for (const icon of await nav.locator('svg.nav-icon').all()) {
      await expect(icon).toHaveAttribute('aria-hidden', 'true')
      await expect(icon).toHaveCSS('width', '20px')
    }
    const workspace = page.getByRole('button', { name: '我的工作空间' })
    await workspace.click()
    await expect(workspace).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('heading', { name: '这次更新了什么' })).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: '设置', exact: true })).toBeFocused()
    await page.getByRole('button', { name: '设置', exact: true }).click()
    await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
    await expect(page.locator('.storage-row')).toHaveCount(3)
    const popoverShadow = await page.locator('.workspace-popover').count()
    expect(popoverShadow).toBe(0)
    await nav.getByRole('button', { name: '文件库' }).click()
    await expect(page.getByRole('heading', { name: '文件库', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '添加文件模板' }).click()
    await expect(page.locator('.modal-card')).toBeVisible()
    await expect(page.getByRole('textbox', { name: '文件名称' })).toBeFocused()
    await expect(page.locator('.modal-card')).toHaveCSS('border-top-left-radius', '13px')
    await page.keyboard.press('Escape')
    await expect(page.locator('.modal-card')).toHaveCount(0)
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1050, 700))
    const width = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(width).toBeLessThanOrEqual(1050)
  } finally { await application.close(); fs.rmSync(root, { recursive: true, force: true }) }
})
