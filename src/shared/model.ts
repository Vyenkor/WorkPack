export const steps = ['prepared', 'filled', 'signed', 'archived'] as const
export type Step = typeof steps[number]
export type Status = 'pending' | 'done' | 'na'
export const stepLabels: Record<Step, string> = { prepared: '准备', filled: '填写', signed: '签字', archived: '归档' }
export interface Rule { id: string; name: string; note: string; required: Step[]; assetId?: string }
export interface Asset { id: string; name: string; path: string; exists: boolean }
export interface Template { id: string; name: string; rules: Rule[]; assets: Asset[] }
export interface Attachment extends Asset { itemId: string; createdAt: string }
export interface Item extends Rule { eventId: string; states: Record<Step, Status>; attachments: Attachment[] }
export interface BusinessEvent { id: string; projectId: string; templateId: string; name: string; date: string; owner: string; items: Item[] }
export interface Project { id: string; name: string; customer: string; contact: string; owner: string; note: string; folder: string; templateIds: string[]; folderExists: boolean; events: BusinessEvent[] }
export interface Snapshot { projects: Project[]; templates: Template[]; dataDirectory: string; pendingView: PendingViewState }
export interface ProjectInput { id?: string; name: string; customer: string; contact: string; owner: string; note: string; templateIds: string[]; directoryToken?: string }
export interface EventInput { projectId: string; templateId: string; name: string; date: string; owner: string }
export interface EventUpdateInput extends EventInput { id: string }
export interface TemplateInput { id?: string; name: string; rules: Rule[] }
export interface ItemInput { id?: string; eventId: string; name: string; note: string; required: Step[] }
export interface WorkPackAPI {
  snapshot(): Promise<Snapshot>
  savePendingView(input: PendingViewState): Promise<PendingViewState>
  chooseDirectory(): Promise<{ token: string; path: string } | null>
  saveProject(input: ProjectInput): Promise<string>
  deleteProject(id: string): Promise<void>
  relocateProject(id: string): Promise<boolean>
  openProject(id: string): Promise<void>
  saveTemplate(input: TemplateInput): Promise<void>
  deleteTemplate(id: string): Promise<void>
  importTemplates(id: string): Promise<boolean>
  removeTemplateAsset(id: string): Promise<void>
  exportTemplates(ids: string[]): Promise<number>
  createEvent(input: EventInput): Promise<string>
  updateEvent(input: EventUpdateInput): Promise<void>
  deleteEvent(id: string): Promise<void>
  completeItem(id: string): Promise<void>
  completeEvent(id: string): Promise<void>
  saveItem(input: ItemInput): Promise<void>
  deleteItem(id: string): Promise<void>
  setStatus(input: { id: string; step: Step; status: Status }): Promise<void>
  importAttachments(id: string): Promise<boolean>
  openAttachment(id: string): Promise<void>
  relocateAttachment(id: string): Promise<boolean>
  removeAttachment(id: string): Promise<void>
}
export function progress(items: Item[]) {
  let total = 0
  let done = 0
  for (const item of items) for (const step of steps) {
    if (item.states[step] === 'na') continue
    total++
    const ready = step !== 'prepared' || item.attachments.some(attachment => attachment.exists)
    if (item.states[step] === 'done' && ready) done++
  }
  return { done, total, percent: total ? Math.round(done / total * 100) : items.length ? 100 : 0 }
}
export function unfinished(items: Item[]): number {
  return items.filter(item => gaps(item).length > 0).length
}
export type CompletionFilter = 'all' | 'open' | 'done'
export type PendingGapFilter = 'all' | 'unprepared' | 'unfilled' | 'unsigned' | 'unarchived'
export interface PendingFilterQuery {
  keyword: string
  projectId: string
  customer: string
  templateId: string
  owner: string
  status: CompletionFilter
  gap: PendingGapFilter
}
export function matchesCompletionFilter(percent: number, hasWork: boolean, status: CompletionFilter) {
  if (status === 'all') return true
  const complete = percent === 100 && hasWork
  return status === 'done' ? complete : !complete
}
const gapStep: Record<Exclude<PendingGapFilter, 'all' | 'unprepared'>, Step> = { unfilled: 'filled', unsigned: 'signed', unarchived: 'archived' }
const unpreparedLabels = new Set(['未上传', '待准备', '附件失效'])
export function gaps(item: Item): string[] {
  const result: string[] = []
  if (item.states.prepared !== 'na' && !item.attachments.some(a => a.exists)) result.push('未上传')
  for (const step of steps) if (item.states[step] === 'pending') result.push(`待${stepLabels[step]}`)
  if (item.attachments.some(a => !a.exists)) result.push('附件失效')
  return result
}
export function itemMatchesGap(item: Item, gap: PendingGapFilter) {
  if (gap === 'all') return true
  const labels = gaps(item)
  if (gap === 'unprepared') return labels.some(label => unpreparedLabels.has(label))
  return labels.includes(`待${stepLabels[gapStep[gap]]}`)
}
export function cachedProjectPercent(projectId: string, cache: Map<string, number>, compute: () => number) {
  const cached = cache.get(projectId)
  if (cached !== undefined) return cached
  const percent = compute()
  cache.set(projectId, percent)
  return percent
}
export function matchesPendingQuery(row: { project: Project; event: BusinessEvent; item: Item }, query: PendingFilterQuery, workflowName: string, projectPercent: number | (() => number)) {
  const customer = query.customer.trim()
  const owner = query.owner.trim()
  if (query.projectId && row.project.id !== query.projectId) return false
  if (customer && row.project.customer.trim() !== customer) return false
  if (query.templateId && row.event.templateId !== query.templateId) return false
  if (owner && row.event.owner.trim() !== owner) return false
  if (query.status !== 'all') {
    const percent = typeof projectPercent === 'function' ? projectPercent() : projectPercent
    if (!matchesCompletionFilter(percent, row.project.events.length > 0, query.status)) return false
  }
  if (!itemMatchesGap(row.item, query.gap)) return false
  const keyword = query.keyword.trim().toLowerCase()
  if (!keyword) return true
  return [row.project.name, row.project.customer, row.project.owner, row.event.name, row.event.owner, row.item.name, workflowName].some(value => value.toLowerCase().includes(keyword))
}
export type PendingGroupBy = 'project' | 'owner' | 'none'
export interface PendingGroup<T> { key: string; label: string; rows: T[] }
export interface PendingViewState { filter: PendingFilterQuery; groupBy: PendingGroupBy }
export const PENDING_VIEW_PREFERENCE_KEY = 'pending.view'
const pendingGroupModes: readonly PendingGroupBy[] = ['project', 'owner', 'none']
const completionFilters: readonly CompletionFilter[] = ['all', 'open', 'done']
const gapFilters: readonly PendingGapFilter[] = ['all', 'unprepared', 'unfilled', 'unsigned', 'unarchived']
export function defaultPendingFilter(): PendingFilterQuery {
  return { keyword: '', projectId: '', customer: '', templateId: '', owner: '', status: 'all', gap: 'all' }
}
export function defaultPendingViewState(): PendingViewState {
  return { filter: defaultPendingFilter(), groupBy: 'project' }
}
function storedString(value: unknown) { return typeof value === 'string' ? value : '' }
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback
}
export function parsePendingViewState(raw: unknown): PendingViewState {
  const fallback = defaultPendingViewState()
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    if (!raw.trim()) return fallback
    try { parsed = JSON.parse(raw) } catch { return fallback }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback
  const record = parsed as Record<string, unknown>
  const filterSource = record.filter && typeof record.filter === 'object' && !Array.isArray(record.filter) ? record.filter as Record<string, unknown> : {}
  return {
    filter: {
      keyword: storedString(filterSource.keyword),
      projectId: storedString(filterSource.projectId),
      customer: storedString(filterSource.customer),
      templateId: storedString(filterSource.templateId),
      owner: storedString(filterSource.owner),
      status: oneOf(filterSource.status, completionFilters, 'all'),
      gap: oneOf(filterSource.gap, gapFilters, 'all')
    },
    groupBy: oneOf(record.groupBy, pendingGroupModes, 'project')
  }
}
export function serializePendingViewState(state: PendingViewState) { return JSON.stringify(parsePendingViewState(state)) }
export function normalizePendingViewState(state: PendingViewState, existing: { projectIds: readonly string[]; templateIds: readonly string[] }): PendingViewState {
  const parsed = parsePendingViewState(state)
  const projects = new Set(existing.projectIds)
  const templates = new Set(existing.templateIds)
  return {
    filter: {
      ...parsed.filter,
      projectId: projects.has(parsed.filter.projectId) ? parsed.filter.projectId : '',
      templateId: templates.has(parsed.filter.templateId) ? parsed.filter.templateId : ''
    },
    groupBy: parsed.groupBy
  }
}
export function groupPendingRows<T extends { project: Pick<Project, 'id' | 'name'>; event: Pick<BusinessEvent, 'owner'> }>(rows: readonly T[], groupBy: PendingGroupBy): PendingGroup<T>[] {
  if (!rows.length) return []
  if (groupBy === 'none') return [{ key: '', label: '', rows: [...rows] }]
  const groups: PendingGroup<T>[] = []
  const index = new Map<string, PendingGroup<T>>()
  for (const row of rows) {
    const byOwner = groupBy === 'owner'
    const key = byOwner ? row.event.owner.trim() : row.project.id
    const label = byOwner ? key || '未填写经办人' : row.project.name.trim() || '未命名项目'
    const existing = index.get(key)
    if (existing) existing.rows.push(row)
    else {
      const group = { key, label, rows: [row] }
      index.set(key, group)
      groups.push(group)
    }
  }
  return groups
}
