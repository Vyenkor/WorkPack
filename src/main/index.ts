import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'
import { WorkPackService } from './service'
import { StorageManager, WorkspaceMissingError, type StorageKind, type WorkspaceRecovery } from './storage'

let service: WorkPackService
let storage: StorageManager
let window: BrowserWindow
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
  handle('copyPath', value => { clipboard.writeText(z.string().min(1).max(32768).refine(text => !text.includes('\0')).parse(value)) })
  handle('savePendingView', value => service.savePendingView(value))
  handle('saveProject', input => service.saveProject(input))
  handle('deleteProject', value => { stringId.parse(value); service.deleteProject(value) })
  handle('relocateProject', async value => { stringId.parse(value); const folder = await selectFolder(); if (!folder) return false; service.relocateProject(value, folder); return true })
  handle('openProject', value => open(service.projectPath(stringId.parse(value))))
  handle('deleteLibraryFile', value => service.deleteLibraryFile(stringId.parse(value)))
  handle('importLibraryFile', async value => { stringId.parse(value); const files = await selectFiles(false); if (!files.length) return false; service.importLibraryFile(value, files); return true })
  handle('removeTemplateAsset', value => service.removeTemplateAsset(stringId.parse(value)))
  handle('exportTemplates', async value => { z.array(stringId).min(1).parse(value); const folder = await selectFolder(); return folder ? service.exportTemplates(value, folder) : 0 })
  handle('updateEvent', value => service.updateEvent(value))
  handle('deleteEvent', value => { stringId.parse(value); service.deleteEvent(value) })
  handle('saveItem', value => service.saveItem(value))
  handle('deleteItem', value => service.deleteItem(stringId.parse(value)))
  handle('importAttachments', async value => { stringId.parse(value); const files = await selectFiles(); if (!files.length) return false; service.importAttachments(value, files); return true })
  handle('openAttachment', value => open(service.attachmentPath(stringId.parse(value))))
  handle('relocateAttachment', async value => { stringId.parse(value); const files = await selectFiles(false); if (!files.length) return false; service.relocateAttachment(value, files[0]); return true })
  handle('removeAttachment', value => service.removeAttachment(stringId.parse(value)))
  handle('saveLibraryCategory', value => service.saveLibraryCategory(value))
  handle('deleteLibraryCategory', value => service.deleteLibraryCategory(stringId.parse(value)))
  handle('saveLibraryFile', value => service.saveLibraryFile(value))
  handle('createLibraryEvent', value => service.createLibraryEvent(value))
  handle('saveDocumentTask', value => service.saveDocumentTask(value))
  handle('setDocumentTaskDone', value => service.setDocumentTaskDone(value))
  handle('deleteDocumentTask', value => service.deleteDocumentTask(stringId.parse(value)))
  handle('storageLocations', () => ({ ...storage.locations }))
  handle('chooseStorageLocation', async value => {
    const kind = z.enum(['project', 'template', 'workspace']).parse(value) as StorageKind
    const folder = await selectFolder()
    if (!folder) return null
    try { return storage.change(kind, folder) }
    finally { service = storage.service }
  })
}

/** Ask before replacing a configured workspace whose database is missing. Returns null when the user quits. */
function openStorage(): StorageManager | null {
  const system = app.getPath('userData'), projects = path.join(app.getPath('documents'), 'WorkPack', '项目')
  let recovery: WorkspaceRecovery | undefined
  for (;;) {
    try { return new StorageManager(system, projects, recovery) }
    catch (error) {
      if (!(error instanceof WorkspaceMissingError)) throw error
      const choice = dialog.showMessageBoxSync({
        type: 'warning', title: 'WorkPack', noLink: true, defaultId: 0, cancelId: 2,
        buttons: ['重新选择文件夹…', '在原位置新建空工作空间', '退出'],
        message: error.message,
        detail: '工作空间文件夹可能被移动、改名，或所在磁盘没有连接。请选择包含 workpack-v3.sqlite 的文件夹；新建空工作空间不会改动原有数据。'
      })
      if (choice === 2) return null
      if (choice === 1) { recovery = { create: true }; continue }
      const selected = dialog.showOpenDialogSync({ title: '选择包含 workpack-v3.sqlite 的文件夹', properties: ['openDirectory'] })
      recovery = selected?.[0] ? { locate: selected[0] } : undefined
    }
  }
}

const hasInstanceLock = app.requestSingleInstanceLock()
if (!hasInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })
  app.whenReady().then(() => {
    const opened = openStorage()
    if (!opened) { app.quit(); return }
    storage = opened
    service = storage.service
    window = new BrowserWindow({
      title: 'WorkPack', width: 1440, height: 960, minWidth: 1050, minHeight: 700,
      icon: path.join(__dirname, '../renderer/icon.png'),
      backgroundColor: '#ededee', show: false,
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
}
app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => service?.close())
