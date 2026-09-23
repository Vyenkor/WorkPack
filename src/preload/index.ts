import { contextBridge, ipcRenderer } from 'electron'
import type { WorkPackAPI } from '../shared/model'

async function call(channel: string, input?: unknown) {
  const result = await ipcRenderer.invoke(`workpack:${channel}`, input)
  if (!result.ok) throw new Error(result.error)
  return result.value
}
const api: WorkPackAPI = {
  snapshot: () => call('snapshot'),
  chooseDirectory: () => call('chooseDirectory'),
  saveProject: input => call('saveProject', input),
  relocateProject: id => call('relocateProject', id),
  openProject: id => call('openProject', id),
  saveTemplate: input => call('saveTemplate', input),
  deleteTemplate: id => call('deleteTemplate', id),
  importTemplates: id => call('importTemplates', id),
  removeTemplateAsset: id => call('removeTemplateAsset', id),
  exportTemplates: ids => call('exportTemplates', ids),
  createEvent: input => call('createEvent', input),
  saveItem: input => call('saveItem', input),
  deleteItem: id => call('deleteItem', id),
  setStatus: input => call('setStatus', input),
  importAttachments: id => call('importAttachments', id),
  openAttachment: id => call('openAttachment', id),
  relocateAttachment: id => call('relocateAttachment', id),
  removeAttachment: id => call('removeAttachment', id)
}
contextBridge.exposeInMainWorld('workpack', Object.freeze(api))
