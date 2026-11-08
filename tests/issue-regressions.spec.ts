import { _electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let app: ElectronApplication
let page: Page
let root: string

test.beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-issues-'))
  app = await _electron.launch({ executablePath: require('electron'), args: ['.'], env: { ...process.env, WORKPACK_TEST_DATA: path.join(root, 'data') } })
  page = await app.firstWindow()
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible()
})

test.afterEach(async () => {
  await app?.close()
  const resolved = path.resolve(root)
  if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('workpack-issues-')) fs.rmSync(resolved, { recursive: true, force: true })
})

function nav(name: string) { return page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name, exact: true }) }

test('issue 34 audit: a saved All choice survives a full app restart while a fresh workspace defaults to Open', async () => {
  const statuses = () => page.getByRole('group', { name: '完成状态', exact: true })
  await nav('待处理').click()
  await expect(statuses().getByRole('button', { name: '未完成', exact: true })).toHaveClass(/active/)
  await statuses().getByRole('button', { name: '全部', exact: true }).click()
  await expect.poll(() => page.evaluate(async () => (await window.workpack.snapshot()).pendingView.filter.status)).toBe('all')
  await app.close()
  app = await _electron.launch({ executablePath: require('electron'), args: ['.'], env: { ...process.env, WORKPACK_TEST_DATA: path.join(root, 'data') } })
  page = await app.firstWindow()
  await expect(page.getByRole('heading', { name: '工作台', exact: true })).toBeVisible()
  await nav('待处理').click()
  await expect(statuses().getByRole('button', { name: '全部', exact: true })).toHaveClass(/active/)
})

test('issue 35: busy drawer rejects Escape, back and scrim until the operation completes', async () => {
  const projects = path.join(root, 'projects')
  fs.mkdirSync(projects)
  await app.evaluate(({ dialog }, folder) => {
    Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [folder] }) })
  }, projects)
  await page.evaluate(async () => {
    await window.workpack.chooseStorageLocation('project')
    const projectId = await window.workpack.saveProject({ name: '忙碌抽屉', customer: '测试客户', owner: '负责人', contact: '', note: '' })
    await window.workpack.saveLibraryFile({ name: '测试文件', purpose: '' })
    const template = (await window.workpack.snapshot()).templates[0]
    await window.workpack.createLibraryEvent({ projectId, templateIds: [template.id], name: '上传资料', date: '2026-11-07', owner: '经办人' })
  })
  await page.reload()
  await nav('项目').click()
  await page.locator('.project-card-main').click()
  await page.locator('.event-card').click()
  const drawer = page.locator('.event-drawer')
  await app.evaluate(({ ipcMain }) => {
    const state = globalThis as unknown as { releaseUpload: () => void }
    ipcMain.removeHandler('workpack:importAttachments')
    ipcMain.handle('workpack:importAttachments', async () => {
      await new Promise<void>(resolve => { state.releaseUpload = resolve })
      return { ok: true, value: false }
    })
  })
  const upload = drawer.getByRole('button', { name: '上传', exact: true })
  await upload.click()
  await expect(upload).toBeDisabled()
  await drawer.getByRole('button', { name: '返回事项', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: '返回事项', exact: true }).click()
  await expect(drawer).toBeVisible()
  await page.locator('.drawer-scrim').click({ position: { x: 8, y: 8 } })
  await expect(drawer).toBeVisible()
  await app.evaluate(() => (globalThis as unknown as { releaseUpload: () => void }).releaseUpload())
  await expect(upload).toBeEnabled()
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
})

test('issue 36: failed preference write drains a newer queued change and persists it', async () => {
  await app.evaluate(({ ipcMain }) => {
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, (...args: any[]) => unknown> })._invokeHandlers
    const original = handlers.get('workpack:savePendingView')!
    const state = globalThis as unknown as { preferenceWrites: unknown[]; releasePreference: () => void }
    state.preferenceWrites = []
    ipcMain.removeHandler('workpack:savePendingView')
    ipcMain.handle('workpack:savePendingView', async (event, value) => {
      state.preferenceWrites.push(value)
      if (state.preferenceWrites.length === 1) {
        await new Promise<void>(resolve => { state.releasePreference = resolve })
        return { ok: false, error: '测试写入失败' }
      }
      return original(event, value)
    })
  })
  await nav('待处理').click()
  const search = page.getByRole('searchbox', { name: '搜索待处理', exact: true })
  await search.fill('第一次')
  await expect.poll(() => app.evaluate(() => (globalThis as unknown as { preferenceWrites: unknown[] }).preferenceWrites.length)).toBe(1)
  await search.fill('最后一次')
  await page.getByRole('group', { name: '分组', exact: true }).getByRole('button', { name: '经办人', exact: true }).click()
  await app.evaluate(() => (globalThis as unknown as { releasePreference: () => void }).releasePreference())
  await expect.poll(() => page.evaluate(async () => (await window.workpack.snapshot()).pendingView)).toMatchObject({ filter: { keyword: '最后一次' }, groupBy: 'owner' })
  expect(await app.evaluate(() => (globalThis as unknown as { preferenceWrites: unknown[] }).preferenceWrites.length)).toBe(2)
  await page.reload()
  await nav('待处理').click()
  await expect(search).toHaveValue('最后一次')
  await expect(page.getByRole('group', { name: '分组', exact: true }).getByRole('button', { name: '经办人', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('issue 51: a rejected task toggle leaves each checkbox matching the saved state', async () => {
  const projects = path.join(root, 'projects'), source = path.join(root, '借用单.txt')
  fs.mkdirSync(projects)
  fs.writeFileSync(source, 'template')
  await app.evaluate(({ dialog }, picks) => {
    const queue = [...picks]
    Object.defineProperty(dialog, 'showOpenDialog', { configurable: true, value: async () => ({ canceled: false, filePaths: [queue.shift()] }) })
  }, [projects, source])
  const attachment = await page.evaluate(async () => {
    await window.workpack.chooseStorageLocation('project')
    const projectId = await window.workpack.saveProject({ name: '勾选失败', customer: '测试客户', owner: '负责人', contact: '', note: '' })
    await window.workpack.saveLibraryFile({ name: '借用单', purpose: '' })
    const template = (await window.workpack.snapshot()).templates[0]
    await window.workpack.importLibraryFile(template.id)
    await window.workpack.createLibraryEvent({ projectId, templateIds: [template.id], name: '借用设备', date: '2026-11-07', owner: '经办人' })
    const project = (await window.workpack.snapshot()).projects[0], item = project.events[0].items[0]
    await window.workpack.saveDocumentTask({ itemId: item.id, name: '签字' })
    return { folder: project.folder, path: item.attachments[0].path }
  })
  const savedTasks = () => page.evaluate(async () => (await window.workpack.snapshot()).projects[0].events[0].items[0].tasks.map(task => task.done))
  await page.reload()
  await nav('项目').click()
  await page.locator('.project-card-main').click()
  await page.locator('.event-card').click()
  const drawer = page.locator('.event-drawer')
  const prepare = drawer.getByRole('checkbox', { name: '准备文件', exact: true })
  const sign = drawer.getByRole('checkbox', { name: '签字', exact: true })
  await expect(prepare).toBeEnabled()

  fs.rmSync(path.join(attachment.folder, attachment.path))
  await prepare.click()
  await expect(page.locator('.toast.error')).toContainText('请先添加文件')
  await expect(prepare).not.toBeChecked()
  await expect(drawer.getByText('文件失效', { exact: true })).toBeVisible()
  expect(await savedTasks()).toEqual([false, false])

  await app.evaluate(({ ipcMain }) => {
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, (...args: any[]) => unknown> })._invokeHandlers
    ;(globalThis as unknown as { setDone: unknown }).setDone = handlers.get('workpack:setDocumentTaskDone')
    ipcMain.removeHandler('workpack:setDocumentTaskDone')
    ipcMain.handle('workpack:setDocumentTaskDone', async () => ({ ok: false, error: '测试写入失败' }))
  })
  await sign.click()
  await expect(page.locator('.toast.error')).toContainText('测试写入失败')
  await expect(sign).not.toBeChecked()
  expect(await savedTasks()).toEqual([false, false])

  await app.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('workpack:setDocumentTaskDone')
    ipcMain.handle('workpack:setDocumentTaskDone', (globalThis as unknown as { setDone: (...args: any[]) => unknown }).setDone)
  })
  await sign.click()
  await expect(sign).toBeChecked()
  expect(await savedTasks()).toEqual([false, true])
})

test('issue 37: Escape dismisses the open category picker before the dirty template dialog', async () => {
  const confirmations: string[] = []
  page.on('dialog', async dialog => { confirmations.push(dialog.message()); await dialog.dismiss() })
  await nav('文件库').click()
  await page.getByRole('button', { name: '添加文件模板', exact: true }).click()
  const name = page.getByRole('textbox', { name: '文件名称', exact: true })
  await name.fill('保留模板内容')
  const category = page.locator('.modal-card').getByRole('combobox', { name: '分类', exact: true })
  await category.click()
  await expect.poll(() => category.evaluate(select => select.matches(':open'))).toBe(true)
  await page.keyboard.press('Escape')
  await expect.poll(() => category.evaluate(select => select.matches(':open'))).toBe(false)
  await expect(page.locator('.modal-card')).toBeVisible()
  await expect(name).toHaveValue('保留模板内容')
  expect(confirmations).toEqual([])
  await page.keyboard.press('Escape')
  expect(confirmations).toEqual(['有未保存修改，关闭？'])
})
