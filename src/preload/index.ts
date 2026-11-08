import { contextBridge, ipcRenderer } from 'electron'
import type { WorkPackAPI } from '../shared/model'

async function call(channel: string, input?: unknown) {
  const result = await ipcRenderer.invoke(`workpack:${channel}`, input)
  if (!result.ok) throw new Error(result.error)
  return result.value
}
const api: WorkPackAPI = {
  snapshot: () => call('snapshot'),
  copyPath: value => call('copyPath', value),
  savePendingView: input => call('savePendingView', input),
  saveProject: input => call('saveProject', input),
  deleteProject: id => call('deleteProject', id),
  relocateProject: id => call('relocateProject', id),
  openProject: id => call('openProject', id),
  deleteLibraryFile: id => call('deleteLibraryFile', id),
  importLibraryFile: id => call('importLibraryFile', id),
  removeTemplateAsset: id => call('removeTemplateAsset', id),
  exportTemplates: ids => call('exportTemplates', ids),
  updateEvent: input => call('updateEvent', input),
  deleteEvent: id => call('deleteEvent', id),
  saveItem: input => call('saveItem', input),
  deleteItem: id => call('deleteItem', id),
  importAttachments: id => call('importAttachments', id),
  openAttachment: id => call('openAttachment', id),
  relocateAttachment: id => call('relocateAttachment', id),
  removeAttachment: id => call('removeAttachment', id),
  saveLibraryCategory: input => call('saveLibraryCategory', input),
  deleteLibraryCategory: id => call('deleteLibraryCategory', id),
  saveLibraryFile: input => call('saveLibraryFile', input),
  createLibraryEvent: input => call('createLibraryEvent', input),
  saveDocumentTask: input => call('saveDocumentTask', input),
  setDocumentTaskDone: input => call('setDocumentTaskDone', input),
  deleteDocumentTask: id => call('deleteDocumentTask', id),
  storageLocations: () => call('storageLocations'),
  unavailableStorage: () => call('unavailableStorage'),
  chooseStorageLocation: kind => call('chooseStorageLocation', kind)
}
contextBridge.exposeInMainWorld('workpack', Object.freeze(api))
