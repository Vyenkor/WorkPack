export interface Asset { id: string; name: string; path: string; exists: boolean }
export interface Template { id: string; name: string; purpose: string; categoryId: string | null; assets: Asset[] }
export interface LibraryCategory { id: string; name: string }
export interface DocumentTask { id: string; itemId: string; name: string; done: boolean; position: number }
export interface Attachment extends Asset { itemId: string; createdAt: string }
export interface Item { id: string; eventId: string; name: string; note: string; attachments: Attachment[]; tasks: DocumentTask[]; templateId: string | null }
export interface BusinessEvent { id: string; projectId: string; templateId: string; templateIds: string[]; name: string; date: string; owner: string; items: Item[] }
export interface Project { id: string; name: string; customer: string; contact: string; owner: string; note: string; folder: string; folderExists: boolean; events: BusinessEvent[] }
export interface Snapshot { projects: Project[]; templates: Template[]; categories: LibraryCategory[]; pendingView: PendingViewState }
export interface StorageLocations { project: string; template: string; workspace: string }
export interface StorageChangeResult { locations: StorageLocations; unavailable: (keyof StorageLocations)[]; warning?: string }
export interface ProjectInput { id?: string; name: string; customer: string; contact: string; owner: string; note: string }
export interface EventInput { projectId: string; templateIds: string[]; name: string; date: string; owner: string }
export interface EventUpdateInput { id: string; projectId: string; name: string; date: string; owner: string }
export interface ItemInput { id?: string; eventId: string; name: string; note: string }
export interface WorkPackAPI {
  snapshot(): Promise<Snapshot>
  copyPath(value: string): Promise<void>
  savePendingView(input: PendingViewState): Promise<PendingViewState>
  saveProject(input: ProjectInput): Promise<string>
  deleteProject(id: string): Promise<void>
  relocateProject(id: string): Promise<boolean>
  openProject(id: string): Promise<void>
  deleteLibraryFile(id: string): Promise<void>
  importLibraryFile(id: string): Promise<boolean>
  removeTemplateAsset(id: string): Promise<void>
  exportTemplates(ids: string[]): Promise<number>
  updateEvent(input: EventUpdateInput): Promise<void>
  deleteEvent(id: string): Promise<void>
  saveItem(input: ItemInput): Promise<void>
  deleteItem(id: string): Promise<void>
  importAttachments(id: string): Promise<boolean>
  openAttachment(id: string): Promise<void>
  relocateAttachment(id: string): Promise<boolean>
  removeAttachment(id: string): Promise<void>
  saveLibraryCategory(input: { id?: string; name: string }): Promise<void>
  deleteLibraryCategory(id: string): Promise<void>
  saveLibraryFile(input: { id?: string; name: string; purpose: string; categoryId?: string | null }): Promise<void>
  createLibraryEvent(input: EventInput): Promise<string>
  saveDocumentTask(input: { id?: string; itemId: string; name: string }): Promise<void>
  setDocumentTaskDone(input: { id: string; done: boolean }): Promise<void>
  deleteDocumentTask(id: string): Promise<void>
  storageLocations(): Promise<StorageLocations>
  unavailableStorage(): Promise<(keyof StorageLocations)[]>
  chooseStorageLocation(kind: keyof StorageLocations): Promise<StorageChangeResult | null>
}
/** `YYYY-MM-DD` on the user's calendar. `toISOString()` gives the UTC date instead. */
export function localDateInput(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function progress(items: Item[]) {
  let total = 0, done = 0
  for (const item of items) for (const task of item.tasks) {
    total++
    if (task.done && (task.position !== 0 || item.attachments.some(file => file.exists))) done++
  }
  return { done, total, percent: total ? Math.round(done / total * 100) : items.length ? 100 : 0 }
}
export function unfinished(items: Item[]): number { return items.filter(item => gaps(item).length > 0).length }
export type CompletionFilter = 'all' | 'open' | 'done'
export interface PendingFilterQuery { keyword: string; projectId: string; customer: string; owner: string; status: CompletionFilter }
/** Uses the same gaps as the pending page; the rounded percentage is for display only. */
export function projectComplete(project: Project) {
  const items = project.events.flatMap(event => event.items)
  return items.length > 0 && items.every(item => gaps(item).length === 0)
}
export function matchesCompletionFilter(complete: boolean, status: CompletionFilter) {
  if (status === 'all') return true
  return status === 'done' ? complete : !complete
}
export function gaps(item: Item): string[] {
  const ready = item.attachments.some(file => file.exists)
  return [
    ...item.tasks.filter(task => !task.done || (task.position === 0 && !ready)).map(task => task.position === 0 ? '待准备文件' : `待${task.name}`),
    ...item.attachments.some(file => !file.exists) ? ['附件失效'] : []
  ]
}
export function matchesPendingQuery(row: { project: Project; event: BusinessEvent; item: Item }, query: PendingFilterQuery) {
  if (query.projectId && row.project.id !== query.projectId) return false
  if (query.customer.trim() && row.project.customer.trim() !== query.customer.trim()) return false
  if (query.owner.trim() && row.event.owner.trim() !== query.owner.trim()) return false
  if (query.status !== 'all') {
    const complete = gaps(row.item).length === 0
    if (query.status === 'done' ? !complete : complete) return false
  }
  const keyword = query.keyword.trim().toLowerCase()
  return !keyword || [row.project.name, row.project.customer, row.project.owner, row.event.name, row.event.owner, row.item.name].some(value => value.toLowerCase().includes(keyword))
}
export type SearchTarget = { project: Project; event?: BusinessEvent }
/** Projects first, then matters by name (including empty ones), then file and attachment names. */
export function findSearchTarget(projects: readonly Project[], keyword: string): SearchTarget | null {
  const value = keyword.trim().toLowerCase()
  if (!value) return null
  const matches = (text: string) => text.toLowerCase().includes(value)
  const project = projects.find(item => [item.name, item.customer, item.owner].some(matches))
  if (project) return { project }
  const events = projects.flatMap(project => project.events.map(event => ({ project, event })))
  return events.find(({ event }) => matches(event.name))
    ?? events.find(({ event }) => event.items.some(item => [item.name, ...item.attachments.map(file => file.name)].some(matches)))
    ?? null
}
export type PendingGroupBy = 'project' | 'owner' | 'none'
export interface PendingGroup<T> { key: string; label: string; rows: T[] }
export interface PendingViewState { filter: PendingFilterQuery; groupBy: PendingGroupBy }
export const PENDING_VIEW_PREFERENCE_KEY = 'pending.view'
export function defaultPendingFilter(): PendingFilterQuery { return { keyword: '', projectId: '', customer: '', owner: '', status: 'open' } }
export function defaultPendingViewState(): PendingViewState { return { filter: defaultPendingFilter(), groupBy: 'project' } }
function storedString(value: unknown) { return typeof value === 'string' ? value : '' }
export function parsePendingViewState(raw: unknown): PendingViewState {
  const fallback = defaultPendingViewState()
  let parsed: unknown = raw
  if (typeof raw === 'string') { try { parsed = JSON.parse(raw) } catch { return fallback } }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback
  const record = parsed as Record<string, unknown>
  const filter = record.filter && typeof record.filter === 'object' && !Array.isArray(record.filter) ? record.filter as Record<string, unknown> : {}
  return {
    filter: {
      keyword: storedString(filter.keyword), projectId: storedString(filter.projectId), customer: storedString(filter.customer), owner: storedString(filter.owner),
      status: filter.status === 'all' || filter.status === 'open' || filter.status === 'done' ? filter.status : fallback.filter.status
    },
    groupBy: record.groupBy === 'owner' || record.groupBy === 'none' ? record.groupBy : 'project'
  }
}
export function serializePendingViewState(state: PendingViewState) { return JSON.stringify(parsePendingViewState(state)) }
export function normalizePendingViewState(state: PendingViewState, existing: { projectIds: readonly string[] }): PendingViewState {
  const parsed = parsePendingViewState(state)
  return { ...parsed, filter: { ...parsed.filter, projectId: existing.projectIds.includes(parsed.filter.projectId) ? parsed.filter.projectId : '' } }
}
export function groupPendingRows<T extends { project: Pick<Project, 'id' | 'name'>; event: Pick<BusinessEvent, 'owner'> }>(rows: readonly T[], groupBy: PendingGroupBy): PendingGroup<T>[] {
  if (!rows.length) return []
  if (groupBy === 'none') return [{ key: '', label: '', rows: [...rows] }]
  const groups: PendingGroup<T>[] = [], index = new Map<string, PendingGroup<T>>()
  for (const row of rows) {
    const byOwner = groupBy === 'owner', key = byOwner ? row.event.owner.trim() : row.project.id
    const label = byOwner ? key || '未填写经办人' : row.project.name.trim() || '未命名项目'
    const existing = index.get(key)
    if (existing) existing.rows.push(row)
    else { const group = { key, label, rows: [row] }; index.set(key, group); groups.push(group) }
  }
  return groups
}
