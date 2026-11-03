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

async function selectFilter(name: string, label: string) {
  await page.getByRole('combobox', { name }).selectOption({ label })
}

test('pending page filters by project, customer, workflow, owner, status, and gap', async () => {
  const nav = page.getByRole('navigation', { name: '主导航' })
  await nav.getByRole('button', { name: '待处理', exact: true }).click()
  await expect(page.getByRole('heading', { name: '已完成' })).toBeVisible()
  for (const name of ['项目', '客户', '流程', '负责人']) await expect(page.getByRole('combobox', { name }).locator('option')).toHaveCount(1)
  await expect(page.getByRole('button', { name: '清除' })).toHaveCount(0)
  await nav.getByRole('button', { name: '项目', exact: true }).click()

  const parent = path.join(testRoot, 'projects')
  fs.mkdirSync(parent)
  await application.evaluate(({ dialog }, folder) => {
    Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [folder] }) })
  }, parent)
  await page.getByRole('button', { name: '新建项目' }).first().click()
  await page.getByRole('textbox', { name: '项目名称' }).fill('筛选甲')
  await page.getByRole('textbox', { name: '客户名称' }).fill('客户甲')
  await page.getByRole('textbox', { name: '负责人' }).fill('负责人甲')
  await page.locator('.template-check input').first().check()
  await page.getByRole('button', { name: '选择文件夹' }).click()
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: '筛选甲' })).toBeVisible()
  await page.getByRole('button', { name: '新建事项' }).first().click()
  await page.getByRole('textbox', { name: '事项名称' }).fill('第一批')
  await page.getByRole('textbox', { name: '经办人' }).fill('经办甲')
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.getByRole('heading', { name: '第一批' })).toBeVisible()

  await nav.getByRole('button', { name: /待处理/ }).click()
  await expect(page.locator('.pending-row')).toHaveCount(4)
  await expect(page.getByRole('combobox', { name: '负责人' }).locator('option')).toHaveText(['全部负责人', '经办甲'])
  await expect(page.locator('.pending-row').first()).toContainText('客户甲')

  await selectFilter('缺口', '未填写')
  await expect(page.locator('.pending-row')).toHaveCount(2)
  await expect(page.getByRole('button', { name: '发货清单' })).toBeVisible()
  await expect(page.getByRole('button', { name: '客户签收单' })).toBeVisible()
  await expect(page.getByRole('button', { name: '物流凭证' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '设备照片' })).toHaveCount(0)

  await page.getByRole('searchbox', { name: '搜索待处理' }).fill('签收')
  await expect(page.locator('.pending-row')).toHaveCount(1)
  await expect(page.getByRole('button', { name: '客户签收单' })).toBeVisible()

  await page.getByRole('searchbox', { name: '搜索待处理' }).fill('没有这个文件')
  await expect(page.getByRole('heading', { name: '没有符合条件的待处理项' })).toBeVisible()
  await expect(page.locator('.pending-row')).toHaveCount(0)

  await page.getByRole('button', { name: '清除' }).click()
  await expect(page.locator('.pending-row')).toHaveCount(4)
  await expect(page.getByRole('combobox', { name: '缺口' })).toHaveValue('all')
  await expect(page.getByRole('searchbox', { name: '搜索待处理' })).toHaveValue('')
  await expect(page.getByRole('button', { name: '清除' })).toHaveCount(0)

  await selectFilter('完成状态', '已完成')
  await expect(page.getByRole('heading', { name: '没有符合条件的待处理项' })).toBeVisible()
  await selectFilter('完成状态', '进行中')
  await selectFilter('客户', '客户甲')
  await selectFilter('项目', '筛选甲')
  await selectFilter('流程', '发货资料模板')
  await selectFilter('负责人', '经办甲')
  await selectFilter('缺口', '未准备')
  await expect(page.locator('.pending-row')).toHaveCount(4)

  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1050, 700))
  const bounds = await page.evaluate(() => {
    const bar = document.querySelector('.pending-filters')!.getBoundingClientRect()
    const view = document.querySelector('.view')!.getBoundingClientRect()
    return { barRight: bar.right, viewRight: view.right, wrapped: bar.height > 48 }
  })
  expect(bounds.barRight).toBeLessThanOrEqual(bounds.viewRight + 1)
  expect(bounds.wrapped).toBe(true)
})
