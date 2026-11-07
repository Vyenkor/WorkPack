import { _electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

// 只在安装包冒烟测试中运行：scripts/installer-smoke.ps1 安装后通过 WORKPACK_INSTALLED_EXE 传入已安装的程序。
const installedExe = process.env.WORKPACK_INSTALLED_EXE

test.skip(!installedExe, '未设置 WORKPACK_INSTALLED_EXE，跳过安装后的程序检查')

let testRoot: string

test.beforeEach(() => {
  testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-installed-'))
})

test.afterEach(() => {
  if (testRoot && path.resolve(testRoot).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(testRoot).startsWith('workpack-installed-')) {
    fs.rmSync(testRoot, { recursive: true, force: true })
  }
})

async function launch(dataDir: string): Promise<[ElectronApplication, Page]> {
  const application = await _electron.launch({ executablePath: installedExe!, env: { ...process.env, WORKPACK_TEST_DATA: dataDir } })
  const page = await application.firstWindow()
  await expect(page.getByRole('heading', { name: '工作台' })).toBeVisible()
  return [application, page]
}

test('安装后的程序能建库、在中文路径下建项目，重启后数据仍在', async () => {
  const dataDir = path.join(testRoot, '应用 数据')
  const parent = path.join(testRoot, '客户 项目')
  fs.mkdirSync(parent)

  let [application, page] = await launch(dataDir)
  expect(await application.evaluate(({ app }) => app.isPackaged)).toBe(true)
  await application.evaluate(({ dialog }, folder) => {
    Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [folder] }) })
  }, parent)
  await page.getByRole('button', { name: '我的工作空间' }).click()
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.locator('.storage-row').first().getByRole('button', { name: '更改位置' }).click()
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '项目', exact: true }).click()
  await page.getByRole('button', { name: '新建项目' }).first().click()
  await page.getByRole('textbox', { name: '项目名称' }).fill('安装 冒烟项目')
  await page.getByRole('textbox', { name: '客户名称' }).fill('测试客户')
  await page.getByRole('textbox', { name: '负责人' }).fill('测试负责人')
  await page.locator('.modal-card button[type="submit"]').click()
  await expect(page.locator('.project-detail h1')).toHaveText('安装 冒烟项目')
  await application.close()

  expect(fs.existsSync(path.join(dataDir, 'workpack-v3.sqlite'))).toBe(true)
  expect(fs.existsSync(path.join(parent, '安装 冒烟项目', '.workpack-project.json'))).toBe(true)

  ;[application, page] = await launch(dataDir)
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '项目', exact: true }).click()
  await expect(page.getByText('安装 冒烟项目').first()).toBeVisible()
  await application.close()
})
