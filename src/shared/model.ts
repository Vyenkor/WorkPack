export const types = ['shipping', 'receiving', 'training'] as const
export type BusinessType = typeof types[number]
export const typeLabels: Record<BusinessType, string> = { shipping: '发货', receiving: '收货', training: '培训' }
export const steps = ['prepared', 'filled', 'signed', 'archived'] as const
export type Step = typeof steps[number]
export type Status = 'pending' | 'done' | 'na'
export const stepLabels: Record<Step, string> = { prepared: '准备', filled: '填写', signed: '签字', archived: '归档' }
export interface Rule { id: string; name: string; note: string; required: Step[]; assetId?: string }
export interface Asset { id: string; name: string; path: string; exists: boolean }
export interface Template { id: string; name: string; type: BusinessType; rules: Rule[]; assets: Asset[] }
export interface Attachment extends Asset { itemId: string; createdAt: string }
export interface Item extends Rule { eventId: string; states: Record<Step, Status>; attachments: Attachment[] }
export interface BusinessEvent { id: string; projectId: string; templateId: string; type: BusinessType; name: string; date: string; owner: string; items: Item[] }
export interface Project { id: string; name: string; customer: string; contact: string; owner: string; note: string; folder: string; templateIds: string[]; folderExists: boolean; events: BusinessEvent[] }
export interface Snapshot { projects: Project[]; templates: Template[]; dataDirectory: string }
export interface ProjectInput { id?: string; name: string; customer: string; contact: string; owner: string; note: string; templateIds: string[]; directoryToken?: string }
export interface EventInput { projectId: string; templateId: string; name: string; date: string; owner: string }
export interface EventUpdateInput extends EventInput { id: string }
export interface TemplateInput { id?: string; name: string; type: BusinessType; rules: Rule[] }
export interface ItemInput { id?: string; eventId: string; name: string; note: string; required: Step[] }
export interface WorkPackAPI {
  snapshot(): Promise<Snapshot>
  chooseDirectory(): Promise<{ token: string; path: string } | null>
  saveProject(input: ProjectInput): Promise<void>
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
export function gaps(item: Item): string[] {
  const result: string[] = []
  if (item.states.prepared !== 'na' && !item.attachments.some(a => a.exists)) result.push('未上传')
  for (const step of steps) if (item.states[step] === 'pending') result.push(`待${stepLabels[step]}`)
  if (item.attachments.some(a => !a.exists)) result.push('附件失效')
  return result
}
