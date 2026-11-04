<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import ItemChecklist from './components/ItemChecklist.vue'
import NavIcon from './components/NavIcon.vue'
import UiIcon from './components/UiIcon.vue'
import workpackLogo from './assets/workpack-logo.png'
import {
  cachedProjectPercent,
  gaps,
  defaultPendingFilter,
  groupPendingRows,
  matchesCompletionFilter,
  matchesPendingQuery,
  progress,
  type CompletionFilter,
  type PendingFilterQuery,
  type PendingGroupBy,
  type PendingViewState,
  type BusinessEvent,
  type Item,
  type Project,
  type Snapshot,
  type StorageLocations,
  type Template
} from '../../shared/model'

type MainView = 'home' | 'projects' | 'pending' | 'templates' | 'project' | 'settings'
type ModalName = 'project' | 'event' | 'template' | 'category' | 'task' | 'item' | null

const emptySnapshot = (): Snapshot => ({ projects: [], templates: [], categories: [], pendingView: { filter: defaultPendingFilter(), groupBy: 'project' } })
const snapshot = ref<Snapshot>(emptySnapshot())
const view = ref<MainView>('home')
const workspaceMenu = ref(false)
const storageLocations = ref<StorageLocations>({ project: '', template: '', workspace: '' })
const activeProjectId = ref<string | null>(null)
const activeEventId = ref<string | null>(null)
const drawerOpen = ref(false)
const drawerCard = ref<HTMLElement | null>(null)
const loading = ref(true)
const busy = ref(false)
const errorMessage = ref('')
const search = ref('')
const projectFilter = reactive({ keyword: '', status: 'all' as CompletionFilter })
const pendingFilter = reactive<PendingFilterQuery>(defaultPendingFilter())
const pendingGroupBy = ref<PendingGroupBy>('project')
let applyingPendingView = false
let pendingViewReady = false
let savingPendingView = false
let pendingViewDirty = false
function currentPendingView(): PendingViewState {
  return { filter: { ...pendingFilter }, groupBy: pendingGroupBy.value }
}
async function flushPendingView() {
  if (applyingPendingView || !pendingViewReady) return
  if (savingPendingView) { pendingViewDirty = true; return }
  savingPendingView = true
  try {
    do {
      pendingViewDirty = false
      const requested = currentPendingView()
      const saved = await window.workpack.savePendingView(requested)
      if (pendingViewDirty) continue
      const projectChanged = saved.filter.projectId !== pendingFilter.projectId
      if (!projectChanged) continue
      applyingPendingView = true
      if (projectChanged) pendingFilter.projectId = saved.filter.projectId
      applyingPendingView = false
    } while (pendingViewDirty)
  } catch { /* This session still filters and groups when the database write fails. */ }
  finally { savingPendingView = false }
}
watch([() => ({ ...pendingFilter }), pendingGroupBy], () => { void flushPendingView() }, { flush: 'sync' })
const modal = ref<ModalName>(null)
const toast = ref({ visible: false, message: '', tone: 'success' as 'success' | 'error' })
let toastTimer: ReturnType<typeof setTimeout> | undefined
const modalCard = ref<HTMLElement | null>(null)
const modalBaseline = ref('')

const projectForm = reactive({ id: '', name: '', customer: '', contact: '', owner: '', note: '', directoryPath: '' })
const eventForm = reactive({ id: '', projectId: '', templateIds: [] as string[], name: '', date: new Date().toISOString().slice(0, 10), owner: '' })
const templateForm = reactive({ id: '', name: '', purpose: '', categoryId: '' })
const categoryForm = reactive({ id: '', name: '' })
const taskForm = reactive({ itemId: '', name: '' })
const itemForm = reactive({ id: '', eventId: '', name: '', note: '' })

const activeProject = computed(() => snapshot.value.projects.find(project => project.id === activeProjectId.value) ?? null)
const activeEvent = computed(() => activeProject.value?.events.find(event => event.id === activeEventId.value) ?? null)

const allEvents = computed(() => snapshot.value.projects.flatMap(project => project.events.map(event => ({ project, event }))))
const itemRows = computed(() => allEvents.value.flatMap(({ project, event }) => event.items.map(item => ({ project, event, item, gaps: gaps(item) }))))
const pendingRows = computed(() => itemRows.value.filter(row => row.gaps.length))
const navPending = computed(() => pendingRows.value.length)
const openEvents = computed(() => allEvents.value.filter(pair => progress(pair.event.items).percent < 100))
const totalItems = computed(() => allEvents.value.reduce((sum, pair) => sum + pair.event.items.length, 0))
const recentProjects = computed(() => [...snapshot.value.projects].sort((a, b) => projectActivity(b).localeCompare(projectActivity(a))).slice(0, 4))
const filteredProjects = computed(() => {
  const keyword = projectFilter.keyword.trim().toLowerCase()
  return snapshot.value.projects.filter(project => {
    const matchesKeyword = !keyword || [project.name, project.customer, project.owner].some(value => value.toLowerCase().includes(keyword))
    const percent = projectProgress(project).percent
    return matchesKeyword && matchesCompletionFilter(percent, project.events.length > 0, projectFilter.status)
  })
})
function sortedUnique(values: string[]) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}
function withSelected(options: string[], selected: string) {
  const value = selected.trim()
  return value && !options.includes(value) ? [...options, value].sort((a, b) => a.localeCompare(b, 'zh-CN')) : options
}
const pendingProjectOptions = computed(() => {
  const names = new Map(pendingRows.value.map(row => [row.project.id, row.project.name]))
  if (pendingFilter.projectId && !names.has(pendingFilter.projectId)) {
    const project = snapshot.value.projects.find(item => item.id === pendingFilter.projectId)
    if (project) names.set(project.id, project.name)
  }
  return [...names.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
})
const pendingCustomerOptions = computed(() => withSelected(sortedUnique(pendingRows.value.map(row => row.project.customer)), pendingFilter.customer))
const pendingOwnerOptions = computed(() => withSelected(sortedUnique(pendingRows.value.map(row => row.event.owner)), pendingFilter.owner))
const pendingFiltersActive = computed(() => Boolean(pendingFilter.keyword.trim() || pendingFilter.projectId || pendingFilter.customer.trim() || pendingFilter.owner.trim() || pendingFilter.status !== 'all'))
function clearPendingFilters() {
  pendingFilter.keyword = ''
  pendingFilter.projectId = ''
  pendingFilter.customer = ''
  pendingFilter.owner = ''
  pendingFilter.status = 'all'
}
const filteredPending = computed(() => {
  const percents = new Map<string, number>()
  return pendingRows.value.filter(row => matchesPendingQuery(row, pendingFilter, () => cachedProjectPercent(row.project.id, percents, () => projectProgress(row.project).percent)))
})
const pendingGroups = computed(() => groupPendingRows(filteredPending.value, pendingGroupBy.value))
const currentBreadcrumb = computed(() => {
  if (view.value !== 'project') return ({ home: '工作台', projects: '项目', pending: '待处理', templates: '文件库', settings: '设置' } as Record<Exclude<MainView, 'project'>, string>)[view.value]
  return activeProject.value?.name ?? '项目详情'
})
const modalDirty = computed(() => Boolean(modal.value && modalBaseline.value && JSON.stringify(currentModalData()) !== modalBaseline.value))

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function currentModalData() {
  if (modal.value === 'project') return clone(projectForm)
  if (modal.value === 'event') return clone(eventForm)
  if (modal.value === 'template') return clone(templateForm)
  if (modal.value === 'category') return clone(categoryForm)
  if (modal.value === 'task') return clone(taskForm)
  if (modal.value === 'item') return clone(itemForm)
  return null
}
function markModalClean() { modalBaseline.value = JSON.stringify(currentModalData()) }
function clearToast() {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value.visible = false
}
function confirmDiscardUnsaved() { return window.confirm('有未保存修改，关闭？') }
function requestCloseModal() {
  if (modalDirty.value && !confirmDiscardUnsaved()) return
  clearToast()
  modal.value = null
}
function focusableElements(root: HTMLElement | null) {
  return Array.from(root?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
}
function trapTab(event: KeyboardEvent, root: HTMLElement | null) {
  const elements = focusableElements(root)
  if (!elements.length) return
  const first = elements[0], last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
function handleModalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); requestCloseModal(); return }
  if (event.key !== 'Tab') return
  trapTab(event, modalCard.value)
}
type DrawerOrigin = { element: HTMLElement | null; list: HTMLElement | null; itemSelector: string; index: number }
let drawerOrigin: DrawerOrigin | null = null
function captureDrawerOrigin() {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (!active || active === document.body || active === document.documentElement || active.closest('.event-drawer, .modal-backdrop')) return
  const item = active.closest<HTMLElement>('.event-card, .pending-row, .attention-row')
  const list = item?.parentElement ?? null
  const itemSelector = item?.classList.contains('event-card') ? ':scope > .event-card' : item?.classList.contains('pending-row') ? ':scope > .pending-row' : item?.classList.contains('attention-row') ? ':scope > .attention-row' : ''
  const items = list && itemSelector ? Array.from(list.querySelectorAll<HTMLElement>(itemSelector)) : []
  drawerOrigin = { element: item ?? active, list, itemSelector, index: item ? items.indexOf(item) : -1 }
}
function drawerFocusFallback(): HTMLElement | null {
  if (view.value === 'pending') return document.querySelector<HTMLElement>('.pending-table')
  if (view.value === 'project') return document.querySelector<HTMLElement>('.event-list-section')
  return document.querySelector<HTMLElement>('main.view')
}
function resolveDrawerFocus(origin: DrawerOrigin | null): HTMLElement | null {
  if (origin?.element?.isConnected) return origin.element
  const list = origin?.list?.isConnected ? origin.list : null
  if (list && origin?.itemSelector) {
    const items = Array.from(list.querySelectorAll<HTMLElement>(origin.itemSelector))
    if (items.length) return items[origin.index >= 0 ? Math.min(origin.index, items.length - 1) : 0] ?? null
  }
  return drawerFocusFallback()
}
function restoreDrawerFocus(origin: DrawerOrigin | null) {
  nextTick(() => {
    requestAnimationFrame(() => {
      if (drawerOpen.value) return
      resolveDrawerFocus(origin)?.focus()
    })
  })
}
function closeDrawer(restoreFocus = false) {
  const origin = drawerOrigin
  drawerOrigin = null
  drawerOpen.value = false
  activeEventId.value = null
  if (view.value !== 'project') activeProjectId.value = null
  if (restoreFocus) restoreDrawerFocus(origin)
}
function requestCloseDrawer() {
  if (modal.value) { requestCloseModal(); return }
  clearToast()
  closeDrawer(true)
}
function focusDrawer() {
  nextTick(() => {
    if (!drawerOpen.value) return
    ;(focusableElements(drawerCard.value)[0] ?? drawerCard.value)?.focus()
  })
}
function handleDrawerKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); requestCloseDrawer(); return }
  if (event.key !== 'Tab') return
  trapTab(event, drawerCard.value)
}
function focusModal() {
  nextTick(() => {
    const firstField = modalCard.value?.querySelector<HTMLElement>('form input:not([disabled]), form textarea:not([disabled]), form select:not([disabled])')
    ;(firstField ?? focusableElements(modalCard.value)[0])?.focus()
  })
}
function handleModalClick(event: MouseEvent) {
  if (!modal.value) return
  const target = event.target as HTMLElement
  const closeButton = target.closest('.modal-close, .modal-actions button:not([type="submit"])')
  if (!closeButton) return
  event.preventDefault()
  event.stopImmediatePropagation()
  requestCloseModal()
}
function showToast(message: string, tone: 'success' | 'error' = 'success') {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { visible: true, message, tone }
  if (tone === 'success') toastTimer = setTimeout(() => { toast.value.visible = false }, 3000)
}
function formatDate(date: string) {
  const value = new Date(`${date}T00:00:00`)
  return Number.isNaN(value.getTime()) ? date : value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}
function formatFullDate(date: string) { return new Date(`${date}T00:00:00`).toLocaleDateString('zh-CN') }
function projectProgress(project: Project) { return progress(project.events.flatMap(event => event.items)) }
function eventProgress(event: BusinessEvent) { return progress(event.items) }
function eventPending(event: BusinessEvent) { return event.items.filter(item => gaps(item).length).length }
function projectActivity(project: Project) { return project.events.reduce((latest, event) => event.date > latest ? event.date : latest, '') }

async function refresh(showLoading: boolean | Event = true) {
  if (showLoading) loading.value = true
  errorMessage.value = ''
  try {
    snapshot.value = await window.workpack.snapshot()
    snapshot.value.projects.sort((a, b) => projectActivity(b).localeCompare(projectActivity(a)))
    if (!pendingViewReady) {
      applyingPendingView = true
      Object.assign(pendingFilter, snapshot.value.pendingView.filter)
      pendingGroupBy.value = snapshot.value.pendingView.groupBy
      applyingPendingView = false
      pendingViewReady = true
    }
    if (pendingFilter.projectId && !snapshot.value.projects.some(project => project.id === pendingFilter.projectId)) pendingFilter.projectId = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '无法读取本地数据'
  } finally {
    if (showLoading) loading.value = false
  }
}
async function run<T>(action: () => Promise<T>, success?: string): Promise<T | boolean> {
  clearToast()
  busy.value = true
  try {
    const result = await action()
    await refresh(false)
    const completed = result === undefined ? true : result === false || result === 0 ? false : result
    if (success && completed !== false) showToast(success)
    return completed
  } catch (error) {
    showToast(error instanceof Error ? error.message : '操作失败', 'error')
    return false
  } finally { busy.value = false }
}
function go(next: MainView) {
  clearToast()
  view.value = next
  workspaceMenu.value = false
  closeDrawer()
  if (next !== 'project') activeProjectId.value = null
}
function openProject(project: Project) {
  clearToast()
  closeDrawer()
  activeProjectId.value = project.id
  view.value = 'project'
}
function showEventDrawer(project: Project, event: BusinessEvent) {
  clearToast()
  captureDrawerOrigin()
  activeProjectId.value = project.id
  activeEventId.value = event.id
  drawerOpen.value = true
}
function openEvent(project: Project, event: BusinessEvent, options?: { projectPage?: boolean }) {
  const stay = !options?.projectPage && (view.value === 'pending' || (view.value === 'project' && activeProjectId.value === project.id))
  if (!stay) view.value = 'project'
  showEventDrawer(project, event)
}
function runGlobalSearch() {
  clearToast()
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) { go('projects'); return }
  const project = snapshot.value.projects.find(item => [item.name, item.customer, item.owner].some(value => value.toLowerCase().includes(keyword)))
  if (project) { openProject(project); return }
  const row = itemRows.value.find(item => [item.event.name, item.item.name, ...item.item.attachments.map(attachment => attachment.name)].some(value => value.toLowerCase().includes(keyword)))
  if (row) { openEvent(row.project, row.event, { projectPage: true }); return }
  showToast('没有找到匹配的项目或文件', 'error')
}

function resetProjectForm(project?: Project) {
  Object.assign(projectForm, project ? { id: project.id, name: project.name, customer: project.customer, contact: project.contact, owner: project.owner, note: project.note, directoryPath: project.folder } : { id: '', name: '', customer: '', contact: '', owner: '', note: '', directoryPath: '' })
}
function openProjectModal(project?: Project) { clearToast(); resetProjectForm(project); modal.value = 'project'; markModalClean() }
async function saveProject() {
  if (!projectForm.name.trim() || !projectForm.customer.trim() || !projectForm.owner.trim()) { showToast('请填写项目名称、客户和负责人', 'error'); return }
  const input = { id: projectForm.id || undefined, name: projectForm.name, customer: projectForm.customer, contact: projectForm.contact, owner: projectForm.owner, note: projectForm.note }
  const saved = await run(() => window.workpack.saveProject(input), '已保存')
  if (typeof saved !== 'string') return
  modal.value = null
  const project = snapshot.value.projects.find(item => item.id === saved)
  if (project) openProject(project)
}

function resetEventForm(project: Project, event?: BusinessEvent) { Object.assign(eventForm, event ? { id: event.id, projectId: project.id, templateIds: [...event.templateIds], name: event.name, date: event.date, owner: event.owner } : { id: '', projectId: project.id, templateIds: [], name: '', date: new Date().toISOString().slice(0, 10), owner: project.owner }) }
function openEventModal(project = activeProject.value, event?: BusinessEvent) { if (!project) return; clearToast(); resetEventForm(project, event); modal.value = 'event'; markModalClean() }
async function saveEvent() {
  if (!eventForm.name.trim() || !eventForm.templateIds.length || !eventForm.owner.trim()) { showToast('请填写事项名称、选择文件并填写经办人', 'error'); return }
  const saved = eventForm.id
    ? await run(() => window.workpack.updateEvent({ id: eventForm.id, projectId: eventForm.projectId, name: eventForm.name, date: eventForm.date, owner: eventForm.owner }), '已保存')
    : await run(() => window.workpack.createLibraryEvent({ projectId: eventForm.projectId, templateIds: [...eventForm.templateIds], name: eventForm.name, date: eventForm.date, owner: eventForm.owner }), '已保存')
  if (!saved) return
  modal.value = null
  const project = snapshot.value.projects.find(item => item.id === eventForm.projectId)
  const event = project?.events.find(item => item.id === (typeof saved === 'string' ? saved : eventForm.id))
  if (project && event) { if (view.value !== 'pending') view.value = 'project'; showEventDrawer(project, event) }
}
function resetTemplateForm(template?: Template) { Object.assign(templateForm, template ? { id: template.id, name: template.name, purpose: template.purpose ?? '', categoryId: template.categoryId ?? '' } : { id: '', name: '', purpose: '', categoryId: '' }) }
function openTemplateModal(template?: Template) { clearToast(); resetTemplateForm(template); modal.value = 'template'; markModalClean() }
async function saveTemplate() {
  if (!templateForm.name.trim()) { showToast('请填写文件名称', 'error'); return }
  const saved = await run(() => window.workpack.saveLibraryFile({ id: templateForm.id || undefined, name: templateForm.name, purpose: templateForm.purpose, categoryId: templateForm.categoryId || null }), '已保存')
  if (saved) modal.value = null
}
async function deleteTemplate(template: Template) {
  if (!window.confirm(`删除文件“${template.name}”？已创建事项和磁盘文件会保留。`)) return
  await run(() => window.workpack.deleteLibraryFile(template.id), '已删除')
}
function openCategoryModal(category?: {id:string;name:string}) { Object.assign(categoryForm, category ?? {id:'',name:''}); modal.value='category'; markModalClean() }
async function saveCategory() { const result=await run(() => window.workpack.saveLibraryCategory({id:categoryForm.id || undefined,name:categoryForm.name}),'已保存'); if(result) modal.value=null }
async function deleteCategory(category:{id:string;name:string}) { if(window.confirm(`删除分类“${category.name}”？其中的文件会保留。`)) await run(() => window.workpack.deleteLibraryCategory(category.id),'已删除') }
const libraryGroups = computed(() => [{id:'',name:'未分类'},...(snapshot.value.categories ?? [])].map(category => ({...category,files:snapshot.value.templates.filter(file => (file.categoryId ?? '') === category.id)})).filter(group => group.files.length || group.id))
async function deleteProject(project: Project) {
  const confirmed = window.confirm(`“${project.name}”的事项、清单及附件记录将被删除。项目文件夹和实际文件会保留。`)
  if (!confirmed) return
  const removed = await run(() => window.workpack.deleteProject(project.id), '已删除，文件夹已保留')
  if (removed) go('projects')
}
async function importTemplateAssets(template: Template) {
  await run(() => window.workpack.importLibraryFile(template.id), '已导入')
}
async function removeTemplateAsset(assetId: string) {
  if (!window.confirm('移除模板文件记录？原文件不会删除。')) return
  await run(() => window.workpack.removeTemplateAsset(assetId), '已移除')
}
async function exportTemplate(template: Template) {
  await run(() => window.workpack.exportTemplates(template.assets.map(asset => asset.id)), '已导出')
}

function resetItemForm(event: BusinessEvent, item?: Item) { Object.assign(itemForm, item ? { id: item.id, eventId: event.id, name: item.name, note: item.note } : { id: '', eventId: event.id, name: '', note: '' }) }
function openItemModal(event: BusinessEvent, item?: Item) { clearToast(); resetItemForm(event, item); modal.value = 'item'; markModalClean() }
async function saveItem() {
  if (!itemForm.name.trim()) { showToast('请填写文件名称', 'error'); return }
  const saved = await run(() => window.workpack.saveItem({ id: itemForm.id || undefined, eventId: itemForm.eventId, name: itemForm.name, note: itemForm.note }), '已保存')
  if (saved) modal.value = null
}
function openTaskModal(item: Item) { Object.assign(taskForm,{itemId:item.id,name:''}); modal.value='task'; markModalClean() }
async function saveTask() { const result=await run(() => window.workpack.saveDocumentTask({...taskForm}),'已添加'); if(result) modal.value=null }
async function toggleTask(id:string,done:boolean,control:HTMLElement) { await keepFocus(() => run(() => window.workpack.setDocumentTaskDone({id,done})),control) }
async function removeTask(id:string) { await run(() => window.workpack.deleteDocumentTask(id),'已删除') }
async function removeItem(item: Item) {
  if (!window.confirm(`删除清单项“${item.name}”？附件记录也会移除。`)) return
  await run(() => window.workpack.deleteItem(item.id), '已删除')
}
async function removeEvent(event: BusinessEvent) {
  if (!window.confirm(`删除事项“${event.name}”？清单记录和项目文件夹中该事项的工作副本、附件都会删除，其他文件会保留。`)) return
  const removed = await run(() => window.workpack.deleteEvent(event.id), '已删除')
  if (removed) closeDrawer(true)
}
async function keepFocus<T>(action: () => Promise<T>, control: HTMLElement | null) {
  const result = await action()
  await nextTick()
  if (control?.isConnected && !control.hasAttribute('disabled')) control.focus({ preventScroll: true })
  return result
}
async function importAttachments(id: string) { await run(() => window.workpack.importAttachments(id), '上传完成') }
async function openAttachment(id: string) { await run(() => window.workpack.openAttachment(id)) }
async function relocateAttachment(id: string) { await run(() => window.workpack.relocateAttachment(id), '已重新关联') }
async function removeAttachment(id: string) { if (window.confirm('移除附件记录？原文件不会删除。')) await run(() => window.workpack.removeAttachment(id), '已移除') }
async function openProjectFolder(project: Project) { await run(() => window.workpack.openProject(project.id)) }
async function relocateProject(project: Project) { const moved = await run(() => window.workpack.relocateProject(project.id), '已重新定位'); if (moved) await refresh() }

function handleWorkspaceOutside(event: MouseEvent) {
  if (!(event.target as HTMLElement).closest('.sidebar-bottom')) workspaceMenu.value = false
}
async function chooseStorage(kind: keyof StorageLocations) {
  clearToast()
  busy.value = true
  try {
    const result = await window.workpack.chooseStorageLocation(kind)
    if (!result) return
    storageLocations.value = result
    await refresh(false)
    showToast('存储位置已更新')
  } catch (error) { showToast(error instanceof Error ? error.message : '更改存储位置失败', 'error') }
  finally { busy.value = false }
}

watch(modal, value => {
  if (value) focusModal()
  else {
    modalBaseline.value = ''
    if (drawerOpen.value) focusDrawer()
  }
})
watch(drawerOpen, open => { if (open) focusDrawer() })
onMounted(() => {
  refresh()
  window.workpack.storageLocations().then(value => { storageLocations.value = value }).catch(() => {})
  document.addEventListener('click', handleModalClick, true)
  document.addEventListener('click', handleWorkspaceOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleModalClick, true)
  document.removeEventListener('click', handleWorkspaceOutside)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><img class="brand-logo" :src="workpackLogo" alt="WorkPack"></div>
      <nav class="nav" aria-label="主导航">
        <button type="button" :class="{ active: view === 'home' }" @click="go('home')"><NavIcon class="nav-icon" name="home" />工作台</button>
        <button type="button" :class="{ active: view === 'projects' || view === 'project' }" @click="go('projects')"><NavIcon class="nav-icon" name="projects" />项目</button>
        <button type="button" :class="{ active: view === 'pending' }" @click="go('pending')"><NavIcon class="nav-icon" name="pending" />待处理 <span v-if="navPending" class="nav-count">{{ navPending }}</span></button>
        <button type="button" :class="{ active: view === 'templates' }" @click="go('templates')"><NavIcon class="nav-icon" name="templates" />文件库</button>
      </nav>
      <div class="sidebar-bottom"><button type="button" class="workspace-switch" aria-controls="workspace-menu" :aria-expanded="workspaceMenu" @click="workspaceMenu = !workspaceMenu" @keydown.esc="workspaceMenu = false"><span class="workspace-avatar">W</span><span>我的工作空间</span><UiIcon name="chevron-down" /></button><div v-if="workspaceMenu" id="workspace-menu" class="workspace-popover" @keydown.esc="workspaceMenu = false"><section class="whats-new" aria-label="这次更新了什么"><h3>这次更新了什么</h3><ul><li>文件库可分类管理模板</li><li>事项文件可自定义待办</li><li>可分别设置三个存储位置</li><li>卸载时可选清理工作空间记录</li></ul></section><button type="button" @click="go('settings')"><UiIcon name="settings" />设置</button></div></div>
    </aside>

    <section class="content-shell" :aria-hidden="drawerOpen ? 'true' : undefined">
      <header class="topbar"><div class="breadcrumb"><span v-if="view === 'project'" class="breadcrumb-link" @click="go('projects')">项目</span><span v-if="view === 'project'" class="breadcrumb-divider">/</span>{{ currentBreadcrumb }}</div><div class="topbar-actions"><label class="global-search"><UiIcon name="search" class="search-icon" /><input v-model="search" type="search" placeholder="搜索项目或客户" aria-label="搜索项目或客户" @keyup.enter="runGlobalSearch"><kbd>↵</kbd></label></div></header>

      <main class="view">
        <div v-if="loading" class="loading-state"><span class="spinner"></span><p>加载中…</p></div>
        <div v-else-if="errorMessage" class="error-state"><div class="empty-icon"><UiIcon name="error" /></div><h2>读取失败</h2><p>{{ errorMessage }}</p><button class="button primary" @click="refresh">重试</button></div>

        <template v-else>
          <section v-if="view === 'home'" class="page-section">
            <div class="page-heading"><div><span class="eyebrow">WORKSPACE OVERVIEW</span><h1>工作台</h1></div><div class="heading-actions"><button class="button secondary" @click="go('templates')">文件库</button><button class="button primary" @click="openProjectModal()">新建项目</button></div></div>
            <div class="stat-grid"><article class="stat-card"><span class="stat-icon violet"><UiIcon name="project" /></span><div><span>项目</span><strong>{{ snapshot.projects.length }}</strong></div></article><article class="stat-card"><span class="stat-icon orange"><UiIcon name="clock" /></span><div><span>待处理</span><strong>{{ navPending }}</strong></div></article><article class="stat-card"><span class="stat-icon blue"><UiIcon name="event" /></span><div><span>未完成事项</span><strong>{{ openEvents.length }}</strong></div></article><article class="stat-card"><span class="stat-icon green"><UiIcon name="file" /></span><div><span>文件库</span><strong>{{ snapshot.templates.length }}</strong></div></article></div>
            <div class="home-grid"><section class="panel attention-panel"><div class="panel-heading"><div><h2>需要关注</h2></div><button class="link" @click="go('pending')">查看全部</button></div><div v-if="!pendingRows.length" class="empty compact"><div class="empty-icon"><UiIcon name="check" /></div><strong>{{ allEvents.length ? '已完成' : '暂无事项' }}</strong></div><button v-for="row in pendingRows.slice(0, 5)" :key="row.item.id" class="attention-row" @click="openEvent(row.project, row.event)"><span class="attention-dot"></span><span class="attention-main"><strong>{{ row.item.name }}</strong><small>{{ row.project.name }} · {{ row.event.name }}</small></span><span class="attention-tags"><span v-for="gap in row.gaps.slice(0, 2)" :key="gap" class="tag orange">{{ gap }}</span></span></button></section><section class="panel recent-panel"><div class="panel-heading"><div><h2>最近项目</h2></div><button class="link" @click="go('projects')">全部项目</button></div><div v-if="!snapshot.projects.length" class="empty compact"><div class="empty-icon"><UiIcon name="plus" /></div><strong>暂无项目</strong></div><button v-for="project in recentProjects" :key="project.id" class="project-mini" @click="openProject(project)"><span class="project-mini-mark">{{ project.name.slice(0, 1) }}</span><span><strong>{{ project.name }}</strong><small>{{ project.customer }}</small></span><span class="mini-progress"><i :style="{ width: `${projectProgress(project).percent}%` }"></i></span><b>{{ projectProgress(project).percent }}%</b></button></section></div>
          </section>

          <section v-else-if="view === 'projects'" class="page-section"><div class="page-heading"><div><span class="eyebrow">PROJECTS</span><h1>项目</h1></div><div class="filter-bar"><label class="filter-search"><UiIcon name="search" class="search-icon" /><input v-model="projectFilter.keyword" placeholder="搜索项目、客户或负责人"></label><select v-model="projectFilter.status"><option value="all">全部完成状态</option><option value="open">进行中</option><option value="done">已完成</option></select><span class="filter-result">共 {{ filteredProjects.length }} 个项目</span></div><button class="button primary" @click="openProjectModal()">新建项目</button></div><div class="project-list"><article v-for="project in filteredProjects" :key="project.id" class="project-card" tabindex="0" role="button" @click="openProject(project)" @keydown.enter.prevent="openProject(project)" @keydown.space.prevent="openProject(project)"><div class="project-card-main"><span class="project-mark">{{ project.name.slice(0, 1) }}</span><div class="project-title"><button class="title-button" @click="openProject(project)">{{ project.name }}</button><span class="project-code">{{ project.customer }}</span><p v-if="project.note">{{ project.note }}</p><small class="project-events">{{ project.events.length }} 个事项</small></div><div class="project-owner"><small>负责人</small><strong>{{ project.owner }}</strong></div><div class="project-progress"><div class="progress-meta"><span>资料进度</span><strong>{{ projectProgress(project).percent }}%</strong></div><div class="progress-track"><i :style="{ width: `${projectProgress(project).percent}%` }"></i></div><small>{{ projectProgress(project).done }} / {{ projectProgress(project).total || 0 }} 项待办</small></div></div><div class="project-card-footer"><span>事项 {{ project.events.length }} 个</span><span>待处理 {{ project.events.reduce((sum, event) => sum + eventPending(event), 0) }} 项</span><span class="folder-status" :class="project.folderExists ? 'ok' : 'warning'"><UiIcon :name="project.folderExists ? 'check' : 'warning'" />{{ project.folderExists ? '项目目录正常' : '项目目录需要重新定位' }}</span><button class="link danger-link project-delete" @click.stop="deleteProject(project)">删除</button><button class="link" @click.stop="openProjectFolder(project)">打开文件夹</button></div></article><div v-if="!filteredProjects.length" class="empty"><div class="empty-icon"><UiIcon name="search" /></div><h3>暂无项目</h3><p>调整筛选或新建项目。</p></div></div></section>

          <section v-else-if="view === 'pending'" class="page-section"><div class="page-heading"><div><span class="eyebrow">FOLLOW UP</span><h1>待处理</h1></div><div class="filter-bar pending-filters"><label class="filter-search"><UiIcon name="search" class="search-icon" /><input v-model="pendingFilter.keyword" type="search" aria-label="搜索待处理" placeholder="搜索项目、事项或文件"></label><select v-model="pendingFilter.projectId" aria-label="项目"><option value="">全部项目</option><option v-for="option in pendingProjectOptions" :key="option.id" :value="option.id">{{ option.name }}</option></select><select v-model="pendingFilter.customer" aria-label="客户"><option value="">全部客户</option><option v-for="customer in pendingCustomerOptions" :key="customer" :value="customer">{{ customer }}</option></select><select v-model="pendingFilter.owner" aria-label="经办人" title="事项经办人"><option value="">全部经办人</option><option v-for="owner in pendingOwnerOptions" :key="owner" :value="owner">{{ owner }}</option></select><select v-model="pendingFilter.status" aria-label="完成状态"><option value="all">全部完成状态</option><option value="open">进行中</option><option value="done">已完成</option></select><button v-if="pendingFiltersActive" type="button" class="button secondary small" @click="clearPendingFilters">清除</button><div class="pending-group-by" role="group" aria-label="分组"><button type="button" :aria-pressed="pendingGroupBy === 'project'" :class="{ active: pendingGroupBy === 'project' }" @click="pendingGroupBy = 'project'">项目</button><button type="button" :aria-pressed="pendingGroupBy === 'owner'" :class="{ active: pendingGroupBy === 'owner' }" @click="pendingGroupBy = 'owner'">经办人</button><button type="button" :aria-pressed="pendingGroupBy === 'none'" :class="{ active: pendingGroupBy === 'none' }" @click="pendingGroupBy = 'none'">不分组</button></div></div><div class="summary-pill"><strong>{{ filteredPending.length }}</strong><span>项</span></div></div><div class="pending-table panel" tabindex="-1"><div v-if="!filteredPending.length" class="empty"><div class="empty-icon"><UiIcon :name="pendingRows.length ? 'search' : 'check'" /></div><h3>{{ pendingRows.length ? '没有符合条件的待处理项' : '已完成' }}</h3><p v-if="pendingRows.length">调整筛选条件。</p></div><template v-else><div class="pending-table-head"><span>文件</span><span>项目及事项</span><span>缺口</span><span title="事项经办人">经办人</span></div><section v-for="group in pendingGroups" :key="`${pendingGroupBy}:${group.key}`" class="pending-group"><h2 v-if="pendingGroupBy !== 'none'" class="pending-group-head"><span>{{ group.label }}</span><span class="pending-group-count">{{ group.rows.length }} 项</span></h2><button v-for="row in group.rows" :key="row.item.id" class="pending-row" @click="openEvent(row.project, row.event)"><span class="pending-file"><span class="file-icon"><UiIcon name="file" /></span><strong>{{ row.item.name }}</strong></span><span><strong>{{ row.project.name }}</strong><small>{{ row.project.customer }} · {{ row.event.name }}</small></span><span class="pending-gaps"><span v-for="gap in row.gaps" :key="gap" class="tag orange">{{ gap }}</span></span><span>{{ row.event.owner }}</span></button></section></template></div></section>

          <section v-else-if="view === 'templates'" class="page-section"><div class="page-heading"><div><span class="eyebrow">FILE LIBRARY</span><h1>文件库</h1></div><div class="heading-actions"><button class="button secondary" @click="openCategoryModal()">新建分类</button><button class="button primary" @click="openTemplateModal()">添加文件模板</button></div></div><div class="notice-banner"><span class="notice-icon"><UiIcon name="info" /></span><span>在事项中选择所需文件，待办清单由每个事项单独管理。</span></div><div v-for="group in libraryGroups" :key="group.id" class="library-group"><div class="section-heading"><h2>{{ group.name }}</h2><div v-if="group.id" class="inline-actions"><button class="link" @click="openCategoryModal(group)">重命名</button><button class="link danger" @click="deleteCategory(group)">删除分类</button></div></div><div class="template-grid"><article v-for="file in group.files" :key="file.id" class="template-card"><div class="template-card-head"><span class="template-icon"><UiIcon name="file" /></span><div><h2>{{ file.name }}</h2><p v-if="file.purpose">{{ file.purpose }}</p></div><button class="more-button" :aria-label="`编辑${file.name}`" @click="openTemplateModal(file)">编辑</button></div><div class="asset-area"><div class="asset-heading"><strong>模板文件</strong><span>{{ file.assets.length ? file.assets[0].exists ? '可用' : '失效' : '未导入' }}</span></div><div v-for="asset in file.assets" :key="asset.id" class="asset-row"><span class="file-icon"><UiIcon name="file" /></span><span class="asset-name" :title="asset.path">{{ asset.name }}</span><button class="asset-remove" title="移除记录" @click="removeTemplateAsset(asset.id)"><UiIcon name="close" /></button></div></div><div class="template-actions"><button class="button secondary small" @click="importTemplateAssets(file)">导入模板</button><button class="button secondary small" :disabled="!file.assets.length" @click="exportTemplate(file)">导出</button><button class="button danger-link small" @click="deleteTemplate(file)">删除</button></div></article></div></div><div v-if="!snapshot.templates.length" class="empty"><div class="empty-icon"><UiIcon name="file" /></div><h3>文件库还没有文件</h3><p>添加模板后，可在创建事项时选用。</p></div></section>

          <section v-else-if="view === 'settings'" class="page-section"><div class="page-heading"><div><span class="eyebrow">WORKSPACE SETTINGS</span><h1>设置</h1></div></div><div class="settings-layout"><nav class="settings-nav" aria-label="设置分类"><span class="active">存储</span></nav><div class="settings-content"><h2>存储</h2><p>选择项目、模板和工作空间数据的位置。</p><div class="storage-row"><div><strong>项目存储位置</strong><span :title="storageLocations.project">{{ storageLocations.project }}</span></div><button class="button secondary" :disabled="busy" @click="chooseStorage('project')">选择文件夹</button></div><div class="storage-row"><div><strong>模板存储位置</strong><span :title="storageLocations.template">{{ storageLocations.template }}</span></div><button class="button secondary" :disabled="busy" @click="chooseStorage('template')">选择文件夹</button></div><div class="storage-row"><div><strong>工作空间数据存储位置</strong><span :title="storageLocations.workspace">{{ storageLocations.workspace }}</span></div><button class="button secondary" :disabled="busy" @click="chooseStorage('workspace')">选择文件夹</button></div></div></div></section>

          <section v-else-if="view === 'project' && activeProject" class="page-section project-detail"><div class="detail-heading"><button class="back-button" @click="go('projects')"><UiIcon name="back" class="back-icon" />项目</button><div class="detail-title-row"><div><span class="eyebrow">PROJECT DETAIL</span><h1>{{ activeProject.name }}</h1><p>{{ activeProject.customer }}<span class="dot-separator">·</span>{{ activeProject.owner }} 负责</p></div><div class="heading-actions"><button class="button secondary" @click="openProjectFolder(activeProject)">打开文件夹</button><button class="button secondary" @click="openProjectModal(activeProject)">编辑</button><button class="button danger-link" @click="deleteProject(activeProject)">删除</button><button class="button primary" @click="openEventModal(activeProject)">新建事项</button></div></div></div><div v-if="!activeProject.folderExists" class="warning-banner"><UiIcon name="warning" class="warning-icon" /><span>项目目录已失效或被移动。请重新定位原项目文件夹，恢复附件和模板文件访问。</span><button class="button warning small" @click="relocateProject(activeProject)">重新定位</button></div><div class="project-overview-grid"><article><span>项目负责人</span><strong>{{ activeProject.owner }}</strong><small v-if="activeProject.contact && activeProject.contact !== activeProject.owner">{{ activeProject.contact }}</small></article><article><span>整体资料进度</span><strong>{{ projectProgress(activeProject).percent }}%</strong></article><article><span>文件清单</span><strong>{{ activeProject.events.reduce((total, event) => total + event.items.length, 0) }} 个</strong></article><article><span>项目文件夹</span><strong class="folder-value" :title="activeProject.folder">{{ activeProject.folder }}</strong><small :class="activeProject.folderExists ? 'text-success' : 'text-warning'">{{ activeProject.folderExists ? '目录可访问' : '目录不可用' }}</small></article></div><div class="event-list-section" tabindex="-1"><div class="section-heading"><div><h2>业务事项</h2></div><span class="section-count">{{ activeProject.events.length }} 个事项</span></div><div v-if="!activeProject.events.length" class="empty panel"><div class="empty-icon"><UiIcon name="event" /></div><h3>暂无事项</h3><button class="button primary" @click="openEventModal(activeProject)">新建事项</button></div><div v-else class="event-cards"><article v-for="event in activeProject.events" :key="event.id" class="event-card" tabindex="0" role="button" @click="openEvent(activeProject, event)" @keydown.enter.prevent="openEvent(activeProject, event)" @keydown.space.prevent="openEvent(activeProject, event)"><div class="event-card-head"><span class="event-type-icon"><UiIcon name="event" /></span><div><span class="event-meta">{{ event.items.length }} 个文件 · {{ formatDate(event.date) }}</span><h3>{{ event.name }}</h3></div></div><div class="event-card-meta"><span>经办人 {{ event.owner }}</span><span>{{ event.items.length }} 个文件项</span><span v-if="eventPending(event)" class="tag orange">待处理 {{ eventPending(event) }}</span><span v-else class="tag green">已完成</span></div><div class="progress-meta"><span>完成进度</span><strong>{{ eventProgress(event).percent }}%</strong></div><div class="progress-track"><i :style="{ width: `${eventProgress(event).percent}%` }"></i></div><div class="event-card-files"><span v-for="item in event.items.slice(0, 4)" :key="item.id" :class="{ done: !gaps(item).length }">{{ item.name }}</span><span v-if="event.items.length > 4">+{{ event.items.length - 4 }} 项</span></div></article></div></div></section>
        </template>
      </main>
      <div v-if="drawerOpen" class="drawer-scrim" @click="requestCloseDrawer"></div>
    </section>

    <div v-if="drawerOpen && activeProject && activeEvent" ref="drawerCard" class="event-drawer" role="dialog" aria-modal="true" aria-labelledby="event-drawer-title" :aria-hidden="modal ? 'true' : undefined" tabindex="-1" @keydown="handleDrawerKeydown">
      <div class="event-detail">
        <div class="event-detail-heading"><div><div class="event-actions"><button class="back-button small-back" @click="requestCloseDrawer"><UiIcon name="back" class="back-icon" />返回事项</button><button class="button secondary small" @click="openEventModal(activeProject, activeEvent)">编辑</button><button class="button danger-link small" @click="removeEvent(activeEvent)">删除</button></div><div class="event-title"><span class="event-type-icon"><UiIcon name="event" /></span><div><span class="event-meta">{{ activeEvent.items.length }} 个文件 · {{ formatFullDate(activeEvent.date) }}</span><h2 id="event-drawer-title">{{ activeEvent.name }}</h2><p>经办人：{{ activeEvent.owner }}</p></div></div></div><div class="event-progress-large"><strong>{{ eventProgress(activeEvent).percent }}%</strong><span>完成度</span><div class="progress-track"><i :style="{ width: `${eventProgress(activeEvent).percent}%` }"></i></div></div></div><div class="checklist-heading"><div><h3>文件清单</h3><p>每份文件都有独立的待办清单。</p></div><div class="heading-actions"><button class="button secondary small" @click="openItemModal(activeEvent)">添加文件项</button></div></div><ItemChecklist :items="activeEvent.items" :busy="busy" @task="toggleTask" @add-task="openTaskModal" @remove-task="removeTask" @edit="item => openItemModal(activeEvent!, item)" @remove="removeItem" @upload="importAttachments" @open="openAttachment" @relocate="relocateAttachment" @detach="removeAttachment" />
      </div>
    </div>

    <div v-if="modal" class="modal-backdrop" @click.self="requestCloseModal"><section ref="modalCard" class="modal-card" :class="{ 'modal-wide': modal === 'event' || modal === 'item' }" role="dialog" aria-modal="true" tabindex="-1" @keydown="handleModalKeydown">
      <template v-if="modal === 'project'"><div class="modal-heading"><div><span class="eyebrow">PROJECT</span><h2>{{ projectForm.id ? '编辑项目' : '新建项目' }}</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form class="form-grid" @submit.prevent="saveProject"><label>项目名称<input v-model="projectForm.name" required maxlength="100" placeholder="例如：华东智造产线升级项目"></label><label>客户名称<input v-model="projectForm.customer" required maxlength="100" placeholder="客户公司或单位"></label><label>负责人<input v-model="projectForm.owner" required maxlength="100" placeholder="项目负责人"></label><label>联系方式<input v-model="projectForm.contact" maxlength="4000" placeholder="电话、邮箱或其他联系方式"></label><label class="full-width">项目备注<textarea v-model="projectForm.note" rows="3" maxlength="4000" placeholder="项目背景或交付范围"></textarea></label><div class="full-width folder-picker"><div><span class="form-label">项目存储位置</span><p class="form-help">新项目会自动创建同名文件夹。</p><span class="selected-path" :title="storageLocations.project">{{ projectForm.id ? projectForm.directoryPath : storageLocations.project }}</span></div></div><div class="modal-actions"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : '保存' }}</button></div></form></template>

      <template v-else-if="modal === 'event'"><div class="modal-heading"><div><span class="eyebrow">BUSINESS EVENT</span><h2>{{ eventForm.id ? '编辑业务事项' : '新建业务事项' }}</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form class="form-grid" @submit.prevent="saveEvent"><label class="full-width">事项名称<input v-model="eventForm.name" required maxlength="100" placeholder="例如：第一批控制柜发货"></label><fieldset class="full-width"><legend>需要的模板文件</legend><div class="template-checks"><label v-for="file in snapshot.templates" :key="file.id" class="template-check"><input v-model="eventForm.templateIds" type="checkbox" :value="file.id" :disabled="Boolean(eventForm.id)"><span class="template-icon tiny"><UiIcon name="file" /></span><span><strong>{{ file.name }}</strong><small>{{ file.purpose || '暂无说明' }}</small></span></label><span v-if="!snapshot.templates.length" class="form-help">请先在文件库添加模板。</span></div></fieldset><label>日期<input v-model="eventForm.date" required type="date"></label><label>经办人<input v-model="eventForm.owner" required maxlength="100"></label><div class="modal-actions full-width"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : eventForm.id ? '保存' : '创建' }}</button></div></form></template>

      <template v-else-if="modal === 'template'"><div class="modal-heading"><div><span class="eyebrow">FILE LIBRARY</span><h2>{{ templateForm.id ? '编辑文件模板' : '添加文件模板' }}</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form class="form-grid" @submit.prevent="saveTemplate"><label class="full-width">文件名称<input v-model="templateForm.name" required maxlength="100" placeholder="例如：发货清单"></label><label class="full-width">用途说明<textarea v-model="templateForm.purpose" rows="3" maxlength="4000" placeholder="这份文件用来做什么"></textarea></label><label class="full-width">分类<select v-model="templateForm.categoryId"><option value="">未分类</option><option v-for="category in snapshot.categories ?? []" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><div class="modal-actions full-width"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">保存</button></div></form></template>
      <template v-else-if="modal === 'category'"><div class="modal-heading"><div><span class="eyebrow">FILE LIBRARY</span><h2>{{ categoryForm.id ? '编辑分类' : '新建分类' }}</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form class="form-grid" @submit.prevent="saveCategory"><label class="full-width">分类名称<input v-model="categoryForm.name" required maxlength="100" placeholder="例如：发货前准备"></label><div class="modal-actions full-width"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">保存</button></div></form></template>
      <template v-else-if="modal === 'task'"><div class="modal-heading"><div><span class="eyebrow">CHECKLIST</span><h2>添加待办</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form class="form-grid" @submit.prevent="saveTask"><label class="full-width">待办名称<input v-model="taskForm.name" required maxlength="100" placeholder="例如：归档"></label><div class="modal-actions full-width"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">添加</button></div></form></template>

      <template v-else-if="modal === 'item'"><div class="modal-heading"><div><span class="eyebrow">CHECKLIST ITEM</span><h2>{{ itemForm.id ? '编辑清单项' : '添加文件项' }}</h2><p>新文件默认包含“准备文件”待办。</p></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form class="form-grid" @submit.prevent="saveItem"><label class="full-width">文件名称<input v-model="itemForm.name" required maxlength="100" placeholder="例如：客户签收单"></label><label class="full-width">文件说明<textarea v-model="itemForm.note" rows="3" maxlength="4000" placeholder="用途或填写要求"></textarea></label><div class="modal-actions"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : '保存' }}</button></div></form></template>
    </section></div>
    <div v-if="toast.visible" class="toast" :class="toast.tone" :role="toast.tone === 'error' ? 'alert' : 'status'"><span><UiIcon :name="toast.tone === 'success' ? 'check' : 'error'" /></span>{{ toast.message }}<button v-if="toast.tone === 'error'" class="toast-close" aria-label="关闭错误提示" @click="clearToast"><UiIcon name="close" /></button></div>
  </div>
</template>
