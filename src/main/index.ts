import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { WorkPackService } from './service'

let service: WorkPackService
let window: BrowserWindow
const directoryGrants = new Map<string, string>()
const stringId = z.string().uuid()
// The test instance uses an isolated local database and never touches production data.
if (process.env.WORKPACK_TEST_DATA) app.setPath('userData', path.resolve(process.env.WORKPACK_TEST_DATA))
const rendererFile = path.join(__dirname, '../renderer/index.html')
const devURL = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
function validRendererFrame(url: string) {
  if (!devURL) return url === pathToFileURL(rendererFile).href
  try { return new URL(url).origin === new URL(devURL).origin }
  catch { return false }
}

function registerIPC() {
  function handle(channel: string, action: (value: any) => unknown) {
    ipcMain.handle(`workpack:${channel}`, async (event, value) => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !validRendererFrame(event.senderFrame.url)) throw new Error('请求来源无效')
      try { return { ok: true, value: await action(value) } }
      catch (error) {
        const message = error instanceof z.ZodError ? error.issues.map(i => i.message).join('；') : error instanceof Error ? error.message : '操作失败'
        return { ok: false, error: message }
      }
    })
  }
  const selectFolder = async () => {
    const result = await dialog.showOpenDialog(window, { title: '选择文件夹', properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  }
  const selectFiles = async (multiple = true) => {
    const result = await dialog.showOpenDialog(window, { title: '选择需要导入的文件', properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'] })
    return result.canceled ? [] : result.filePaths
  }
  const open = async (file: string) => { const error = await shell.openPath(file); if (error) throw new Error(`无法打开：${error}`) }
  handle('snapshot', () => service.snapshot())
  handle('chooseDirectory', async () => {
    const folder = await selectFolder()
    if (!folder) return null
    if (directoryGrants.size > 50) directoryGrants.clear()
    const token = randomUUID(); directoryGrants.set(token, folder)
    return { token, path: folder }
  })
  handle('saveProject', input => {
    const grant = z.object({ directoryToken: z.string().uuid().optional() }).parse(input)
    service.saveProject(input, grant.directoryToken ? directoryGrants.get(grant.directoryToken) : undefined)
    if (grant.directoryToken) directoryGrants.delete(grant.directoryToken)
  })
  handle('deleteProject', value => { stringId.parse(value); service.deleteProject(value) })
  handle('relocateProject', async value => { stringId.parse(value); const folder = await selectFolder(); if (!folder) return false; service.relocateProject(value, folder); return true })
  handle('openProject', value => open(service.projectPath(stringId.parse(value))))
  handle('saveTemplate', value => service.saveTemplate(value))
  handle('deleteTemplate', value => service.deleteTemplate(stringId.parse(value)))
  handle('importTemplates', async value => { stringId.parse(value); const files = await selectFiles(); if (!files.length) return false; service.importTemplates(value, files); return true })
  handle('removeTemplateAsset', value => service.removeTemplateAsset(stringId.parse(value)))
  handle('exportTemplates', async value => { z.array(stringId).min(1).parse(value); const folder = await selectFolder(); return folder ? service.exportTemplates(value, folder) : 0 })
  handle('createEvent', value => service.createEvent(value))
  handle('updateEvent', value => service.updateEvent(value))
  handle('deleteEvent', value => { stringId.parse(value); service.deleteEvent(value) })
  handle('completeItem', value => { stringId.parse(value); service.completeItem(value) })
  handle('completeEvent', value => { stringId.parse(value); service.completeEvent(value) })
  handle('saveItem', value => service.saveItem(value))
  handle('deleteItem', value => service.deleteItem(stringId.parse(value)))
  handle('setStatus', value => service.setStatus(value))
  handle('importAttachments', async value => { stringId.parse(value); const files = await selectFiles(); if (!files.length) return false; service.importAttachments(value, files); return true })
  handle('openAttachment', value => open(service.attachmentPath(stringId.parse(value))))
  handle('relocateAttachment', async value => { stringId.parse(value); const files = await selectFiles(false); if (!files.length) return false; service.relocateAttachment(value, files[0]); return true })
  handle('removeAttachment', value => service.removeAttachment(stringId.parse(value)))
}

app.whenReady().then(() => {
  service = new WorkPackService(app.getPath('userData'))
  window = new BrowserWindow({
    title: 'WorkPack · 项目资料管理', width: 1440, height: 960, minWidth: 1050, minHeight: 700,
    backgroundColor: '#f5f7f6', show: false,
    webPreferences: { preload: path.join(__dirname, '../preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  })
  window.removeMenu()
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  window.webContents.session.setPermissionCheckHandler(() => false)
  registerIPC()
  window.once('ready-to-show', () => window.show())
  if (devURL) window.loadURL(devURL)
  else window.loadFile(rendererFile)
}).catch(error => { dialog.showErrorBox('WorkPack 启动失败', String(error)); app.quit() })
app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => service?.close())
