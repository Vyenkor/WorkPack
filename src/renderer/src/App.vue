<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import ActionMenu from './components/ActionMenu.vue'
import ItemChecklist from './components/ItemChecklist.vue'
import NavIcon from './components/NavIcon.vue'
import UiIcon from './components/UiIcon.vue'
import workpackLogo from './assets/workpack-logo.png'
import {
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
type PageLocation = { view: MainView; projectId: string | null }
type ModalName = 'project' | 'event' | 'template' | 'category' | 'task' | 'item' | null

const emptySnapshot = (): Snapshot => ({ projects: [], templates: [], categories: [], pendingView: { filter: defaultPendingFilter(), groupBy: 'project' } })
const snapshot = ref<Snapshot>(emptySnapshot())
const view = ref<MainView>('home')
const sidebarCollapsed = ref(false)
const workspaceMenu = ref(false)
const workspaceTrigger = ref<HTMLButtonElement | null>(null)
function closeWorkspaceMenu() { workspaceMenu.value = false; workspaceTrigger.value?.focus() }
function workspaceFocusOut(event: FocusEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) workspaceMenu.value = false
}
const storageLocations = ref<StorageLocations>({ project: '', template: '', workspace: '' })
const storageNotice = ref('')
const activeProjectId = ref<string | null>(null)
const activeEventId = ref<string | null>(null)
const drawerOpen = ref(false)
const drawerCard = ref<HTMLElement | null>(null)
const loading = ref(true)
const busy = ref(false)
const errorMessage = ref('')
const search = ref('')
const globalSearchInput = ref<HTMLInputElement | null>(null)
const librarySearch = ref('')
const libraryCategory = ref<string | null>(null)
const statusOptions: { value: CompletionFilter; label: string }[] = [{ value: 'all', label: '全部' }, { value: 'open', label: '未完成' }, { value: 'done', label: '已完成' }]
const storageKinds: { key: keyof StorageLocations; label: string }[] = [{ key: 'project', label: '项目存储位置' }, { key: 'template', label: '模板存储位置' }, { key: 'workspace', label: '工作空间数据位置' }]
const filteredLibrary = computed(() => snapshot.value.templates.filter(file =>
  (libraryCategory.value === null || (file.categoryId ?? '') === libraryCategory.value) &&
  [file.name, file.purpose, ...file.assets.map(asset => asset.name)].some(value => value.toLowerCase().includes(librarySearch.value.trim().toLowerCase()))))
const selectedCategory = computed(() => snapshot.value.categories.find(category => category.id === libraryCategory.value))
function categoryName(id: string | null) { return snapshot.value.categories.find(category => category.id === id)?.name ?? '未分类' }
function templateStatus(file: Template) { return !file.assets.length ? '未导入' : file.assets.every(asset => asset.exists) ? '可用' : '失效' }
function shortPath(value: string) { const separator = value.includes('\\') ? '\\' : '/'; const parts = value.split(/[\\/]/); return parts.length > 3 ? `…${separator}${parts.slice(-3).join(separator)}` : value }
async function copyPath(value: string) {
  try { await window.workpack.copyPath(value); showToast('路径已复制') }
  catch { showToast('无法复制路径，请重试', 'error') }
}
function searchShortcut(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !modal.value && !drawerOpen.value) {
    event.preventDefault(); globalSearchInput.value?.focus(); globalSearchInput.value?.select()
  }
  if (event.altKey && !event.ctrlKey && !event.metaKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault()
    if (modal.value || drawerOpen.value || busy.value || loading.value) return
    travelPage(event.key === 'ArrowLeft' ? -1 : 1)
  }
}

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

const pageLocations = ref<PageLocation[]>([{ view: 'home', projectId: null }])
const pageLocationIndex = ref(0)
let restoringPage = false
watch([view, activeProjectId], () => {
  if (restoringPage || loading.value || (view.value === 'project' && !activeProject.value)) return
  const location: PageLocation = { view: view.value, projectId: view.value === 'project' ? activeProjectId.value : null }
  const current = pageLocations.value[pageLocationIndex.value]
  if (current.view === location.view && current.projectId === location.projectId) return
  pageLocations.value = [...pageLocations.value.slice(0, pageLocationIndex.value + 1), location]
  pageLocationIndex.value = pageLocations.value.length - 1
}, { flush: 'post' })
function availablePageIndex(direction: -1 | 1) {
  const current = pageLocations.value[pageLocationIndex.value]
  for (let index = pageLocationIndex.value + direction; index >= 0 && index < pageLocations.value.length; index += direction) {
    const location = pageLocations.value[index]
    if (location.view === current.view && location.projectId === current.projectId) continue
    if (location.view !== 'project' || snapshot.value.projects.some(project => project.id === location.projectId)) return index
  }
  return -1
}
const previousPageIndex = computed(() => availablePageIndex(-1))
const nextPageIndex = computed(() => availablePageIndex(1))
async function travelPage(direction: -1 | 1) {
  if (modal.value || drawerOpen.value || busy.value || loading.value) return
  const index = direction === -1 ? previousPageIndex.value : nextPageIndex.value
  if (index < 0) return
  restoringPage = true
  clearToast()
  workspaceMenu.value = false
  closeDrawer()
  pageLocationIndex.value = index
  const location = pageLocations.value[index]
  view.value = location.view
  activeProjectId.value = location.projectId
  await nextTick()
  restoringPage = false
  if (document.activeElement?.matches('button:disabled')) document.querySelector<HTMLElement>('main.view')?.focus()
}
function toggleSidebar() {
  workspaceMenu.value = false
  sidebarCollapsed.value = !sidebarCollapsed.value
}

const allEvents = computed(() => snapshot.value.projects.flatMap(project => project.events.map(event => ({ project, event }))))
const itemRows = computed(() => allEvents.value.flatMap(({ project, event }) => event.items.map(item => ({ project, event, item, gaps: gaps(item) }))))
const pendingRows = computed(() => itemRows.value.filter(row => row.gaps.length))
const navPending = computed(() => pendingRows.value.length)
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
  const names = new Map(itemRows.value.map(row => [row.project.id, row.project.name]))
  if (pendingFilter.projectId && !names.has(pendingFilter.projectId)) {
    const project = snapshot.value.projects.find(item => item.id === pendingFilter.projectId)
    if (project) names.set(project.id, project.name)
  }
  return [...names.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
})
const pendingCustomerOptions = computed(() => withSelected(sortedUnique(itemRows.value.map(row => row.project.customer)), pendingFilter.customer))
const pendingOwnerOptions = computed(() => withSelected(sortedUnique(itemRows.value.map(row => row.event.owner)), pendingFilter.owner))
const pendingFiltersActive = computed(() => Boolean(pendingFilter.keyword.trim() || pendingFilter.projectId || pendingFilter.customer.trim() || pendingFilter.owner.trim() || pendingFilter.status !== defaultPendingFilter().status))
function clearPendingFilters() {
  Object.assign(pendingFilter, defaultPendingFilter())
}
const filteredPending = computed(() => itemRows.value.filter(row =>
  matchesPendingQuery(row, pendingFilter)))
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
  if (busy.value) return
  if (modalDirty.value && !confirmDiscardUnsaved()) return
  clearToast()
  modal.value = null
}
function focusableElements(root: HTMLElement | null) {
  return Array.from(root?.querySelectorAll<HTMLElement>('button:enabled, input:enabled, textarea:enabled, select:enabled, [tabindex]:not([tabindex="-1"])') ?? [])
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
  if (busy.value) return false
  const drawerControl = drawerCard.value?.contains(document.activeElement) ? document.activeElement as HTMLElement : null
  const modalControl = modalCard.value?.contains(document.activeElement) ? document.activeElement as HTMLElement : null
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
  } finally {
    busy.value = false
    await nextTick()
    if (modalControl && modal.value && !modalCard.value?.contains(document.activeElement)) {
      const target = modalControl.isConnected && !modalControl.matches(':disabled') ? modalControl : focusableElements(modalCard.value)[0]
      target?.focus({ preventScroll: true })
    }
    // Refresh can replace or remove the focused attachment/menu control.
    if (drawerControl && drawerOpen.value && !modal.value && !drawerCard.value?.contains(document.activeElement)) {
      const target = drawerControl.isConnected && !drawerControl.hasAttribute('disabled') ? drawerControl : focusableElements(drawerCard.value)[0]
      target?.focus({ preventScroll: true })
    }
  }
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
  const stay = !options?.projectPage && (
    view.value === 'home' || view.value === 'pending' || (view.value === 'project' && activeProjectId.value === project.id)
  )
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
  if (!eventForm.name.trim() || (!eventForm.id && !eventForm.templateIds.length) || !eventForm.owner.trim()) { showToast('请填写事项名称、选择文件并填写经办人', 'error'); return }
  const saved = eventForm.id
    ? await run(() => window.workpack.updateEvent({ id: eventForm.id, projectId: eventForm.projectId, name: eventForm.name, date: eventForm.date, owner: eventForm.owner }), '已保存')
    : await run(() => window.workpack.createLibraryEvent({ projectId: eventForm.projectId, templateIds: [...eventForm.templateIds], name: eventForm.name, date: eventForm.date, owner: eventForm.owner }), '已保存')
  if (!saved) return
  modal.value = null
  const project = snapshot.value.projects.find(item => item.id === eventForm.projectId)
  const event = project?.events.find(item => item.id === (typeof saved === 'string' ? saved : eventForm.id))
  if (project && event) {
    if (view.value !== 'pending' && view.value !== 'home') view.value = 'project'
    showEventDrawer(project, event)
  }
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
async function deleteCategory(category:{id:string;name:string}) { if(window.confirm(`删除分类“${category.name}”？其中的文件会保留。`)) { const result = await run(() => window.workpack.deleteLibraryCategory(category.id),'已删除'); if (result) libraryCategory.value = null } }
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
  if (!(event.target as HTMLElement).closest('.workspace-control')) workspaceMenu.value = false
}
async function chooseStorage(kind: keyof StorageLocations) {
  clearToast()
  busy.value = true
  try {
    const result = await window.workpack.chooseStorageLocation(kind)
    if (!result) return
    storageLocations.value = result.locations
    storageNotice.value = result.warning ?? ''
    await refresh(false)
    showToast('存储位置已更新')
  } catch (error) { showToast(error instanceof Error ? error.message : '更改存储位置失败', 'error') }
  finally { busy.value = false }
}

let modalOrigin: HTMLElement | null = null
watch(modal, value => {
  if (value) {
    const active = document.activeElement as HTMLElement | null
    modalOrigin = active?.closest('.action-menu')?.querySelector<HTMLButtonElement>('.menu-trigger') ?? active
    focusModal()
  }
  else {
    modalBaseline.value = ''
    if (modalOrigin?.isConnected) nextTick(() => modalOrigin?.focus())
    else if (drawerOpen.value) focusDrawer()
  }
})
watch(drawerOpen, open => { if (open) focusDrawer() })
onMounted(() => {
  refresh()
  window.workpack.storageLocations().then(value => { storageLocations.value = value }).catch(() => {})
  document.addEventListener('click', handleModalClick, true)
  document.addEventListener('click', handleWorkspaceOutside)
  document.addEventListener('keydown', searchShortcut)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleModalClick, true)
  document.removeEventListener('click', handleWorkspaceOutside)
  document.removeEventListener('keydown', searchShortcut)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <nav class="sidebar-tools" aria-label="页面导航" :inert="drawerOpen || Boolean(modal)">
      <button class="icon-button sidebar-toggle" type="button" :aria-label="sidebarCollapsed ? '展开侧栏' : '折叠侧栏'" :title="sidebarCollapsed ? '展开侧栏' : '折叠侧栏'" aria-controls="workspace-sidebar" :aria-expanded="!sidebarCollapsed" @click="toggleSidebar"><UiIcon name="sidebar" /></button>
      <button class="icon-button" type="button" aria-label="返回上一步" title="返回上一步（Alt+←）" :disabled="previousPageIndex < 0 || busy || loading" @click="travelPage(-1)"><UiIcon name="back" /></button>
      <button class="icon-button" type="button" aria-label="前进一步" title="前进一步（Alt+→）" :disabled="nextPageIndex < 0 || busy || loading" @click="travelPage(1)"><UiIcon name="forward" /></button>
    </nav>
    <aside v-show="!sidebarCollapsed" id="workspace-sidebar" class="sidebar" :inert="drawerOpen || Boolean(modal)">
      <div class="workspace-control" @focusout="workspaceFocusOut"><button ref="workspaceTrigger" type="button" class="workspace-switch" aria-controls="workspace-menu" :aria-expanded="workspaceMenu" @click="workspaceMenu = !workspaceMenu" @keydown.esc.stop.prevent="closeWorkspaceMenu"><span class="workspace-avatar">W</span><span>我的工作空间</span><UiIcon name="chevron-down" /></button><div v-if="workspaceMenu" id="workspace-menu" class="workspace-popover" @keydown.esc.stop.prevent="closeWorkspaceMenu"><section class="whats-new" aria-label="这次更新了什么"><h3>这次更新了什么</h3><ul><li>浅色工作区与紧凑列表</li><li>文件库新增搜索与分类筛选</li><li>待处理默认显示未完成文件</li><li>存储路径支持一键复制</li></ul></section><button type="button" @click="go('settings')"><UiIcon name="settings" />设置</button></div></div>
      <nav class="nav" aria-label="主导航">
        <button type="button" :aria-current="(view === 'home') ? 'page' : undefined" @click="go('home')"><NavIcon class="nav-icon" name="home" />工作台</button>
        <button type="button" :aria-current="(view === 'projects' || view === 'project') ? 'page' : undefined" @click="go('projects')"><NavIcon class="nav-icon" name="projects" />项目</button>
        <button type="button" aria-label="待处理" :aria-current="(view === 'pending') ? 'page' : undefined" @click="go('pending')"><NavIcon class="nav-icon" name="pending" />待处理 <span v-if="navPending" class="nav-count">{{ navPending }}</span></button>
        <button type="button" :aria-current="(view === 'templates') ? 'page' : undefined" @click="go('templates')"><UiIcon class="nav-icon" name="library" />文件库</button>
      </nav>
    </aside>

    <section class="content-shell" :aria-hidden="drawerOpen ? 'true' : undefined">
      <header class="topbar" :inert="drawerOpen || Boolean(modal)"><div class="breadcrumb"><button v-if="view === 'project'" class="breadcrumb-link" @click="go('projects')">项目</button><UiIcon v-if="view === 'project'" name="back" class="breadcrumb-divider" /><span class="breadcrumb-current" :title="currentBreadcrumb">{{ currentBreadcrumb }}</span></div><div class="topbar-actions"><label class="global-search"><UiIcon name="search" class="search-icon" /><input ref="globalSearchInput" v-model="search" type="search" placeholder="搜索项目或客户" aria-label="搜索项目或客户" @keyup.enter="runGlobalSearch"><kbd>Ctrl K</kbd></label></div></header>

      <main class="view" :inert="drawerOpen || Boolean(modal)" tabindex="-1">
        <div v-if="loading" class="loading-state"><span class="spinner"></span><p>加载中…</p></div>
        <div v-else-if="errorMessage" class="error-state"><div class="empty-icon"><UiIcon name="error" /></div><h2>读取失败</h2><p>{{ errorMessage }}</p><button class="button primary" @click="refresh">重试</button></div>

        <template v-else>
          <section v-if="view === 'home'" class="page-section home-page">
            <div class="page-heading"><h1>工作台</h1><button class="button primary" @click="openProjectModal()"><UiIcon name="plus" />新建项目</button></div>
            <div class="home-grid">
              <section class="attention-panel">
                <div class="panel-heading"><div class="title-with-count"><h2>待处理文件</h2><span class="count-badge">{{ navPending }}</span></div><button class="link muted" @click="go('pending')">查看全部<UiIcon name="arrow" /></button></div>
                <div v-if="!pendingRows.length" class="empty compact"><UiIcon name="check" class="empty-icon" /><strong>暂无待处理文件</strong></div>
                <template v-else>
                  <div class="attention-columns"><span>文件</span><span>项目及事项</span><span>待办状态</span></div>
                  <button v-for="row in pendingRows.slice(0, 5)" :key="row.item.id" class="attention-row" @click="openEvent(row.project, row.event)">
                    <span class="pending-file"><UiIcon name="file" /><strong>{{ row.item.name }}</strong></span>
                    <span class="attention-main"><strong>{{ row.project.name }}</strong><small>{{ row.event.name }}</small></span>
                    <span class="attention-tags"><span v-for="gap in row.gaps.slice(0, 2)" :key="gap" class="tag orange">{{ gap }}</span></span>
                  </button>
                </template>
              </section>
              <section class="recent-panel">
                <div class="panel-heading"><h2>最近项目</h2><button class="link muted" @click="go('projects')">全部项目<UiIcon name="arrow" /></button></div>
                <div v-if="!snapshot.projects.length" class="empty compact"><UiIcon name="cube" class="empty-icon" /><strong>还没有项目</strong></div>
                <button v-for="project in recentProjects" :key="project.id" class="project-mini" @click="openProject(project)">
                  <UiIcon name="cube" /><span><strong>{{ project.name }}</strong><small>{{ project.customer }}</small></span>
                  <span class="mini-progress"><i :style="{ width: `${projectProgress(project).percent}%` }"></i></span><b>{{ projectProgress(project).percent }}%</b>
                </button>
              </section>
            </div>
          </section>

          <section v-else-if="view === 'projects'" class="page-section projects-page">
            <div class="page-heading"><h1>项目</h1><button class="button primary" @click="openProjectModal()"><UiIcon name="plus" />新建项目</button></div>
            <div class="filter-bar project-filters"><label class="filter-search"><UiIcon name="search" /><input v-model="projectFilter.keyword" type="search" aria-label="搜索项目" placeholder="搜索项目、客户或负责人"></label><div class="segmented" role="group" aria-label="项目完成状态"><button v-for="option in statusOptions" :key="option.value" :aria-pressed="projectFilter.status === option.value" :class="{ active: projectFilter.status === option.value }" @click="projectFilter.status = option.value">{{ option.value === 'open' ? '进行中' : option.label }}</button></div></div>
            <div class="project-list">
              <div v-if="filteredProjects.length" class="project-columns" aria-hidden="true">
                <span>名称</span><span>客户</span><span>负责人</span><span>事项</span><span>进度</span><span>操作</span>
              </div>
              <article v-for="project in filteredProjects" :key="project.id" class="project-card">
                <button class="project-card-main" @click="openProject(project)"><span class="project-title"><UiIcon name="cube" class="project-mark" /><strong>{{ project.name }}</strong></span><span class="project-customer">{{ project.customer }}</span><span class="project-owner" :title="`负责人：${project.owner}`">{{ project.owner }}</span><span class="project-events" :title="`${project.events.length} 项事项`">{{ project.events.length }}</span><span class="project-progress"><span class="progress-track"><i :style="{ width: `${projectProgress(project).percent}%` }"></i></span><strong>{{ projectProgress(project).percent }}%</strong></span></button>
                <div class="project-card-footer"><button class="icon-button" aria-label="打开文件夹" title="打开文件夹" :disabled="busy" @click="openProjectFolder(project)"><UiIcon name="project" /></button><ActionMenu :label="`${project.name}操作`" :disabled="busy"><button @click="openProjectModal(project)"><UiIcon name="edit" />编辑项目</button><button v-if="!project.folderExists" @click="relocateProject(project)"><UiIcon name="project" />重新定位</button><button class="danger" @click="deleteProject(project)">删除项目</button></ActionMenu></div>
                <span v-if="!project.folderExists" class="project-folder-warning"><UiIcon name="warning" />目录不可用<button class="link" @click="relocateProject(project)">重新定位</button></span>
              </article>
              <div v-if="!filteredProjects.length" class="empty"><UiIcon name="cube" class="empty-icon" /><h3>{{ snapshot.projects.length ? '没有符合条件的项目' : '还没有项目' }}</h3><button v-if="snapshot.projects.length" class="button secondary" @click="projectFilter.keyword = ''; projectFilter.status = 'all'">清除筛选</button></div>
            </div><div class="list-footer">共 {{ filteredProjects.length }} 个项目</div>
          </section>

          <section v-else-if="view === 'pending'" class="page-section pending-page">
            <div class="page-heading"><div class="title-with-count"><h1>待处理</h1><span>{{ filteredPending.length }} 项</span></div></div>
            <div class="status-tabs" role="group" aria-label="完成状态"><button v-for="option in statusOptions" :key="option.value" :aria-pressed="pendingFilter.status === option.value" :class="{ active: pendingFilter.status === option.value }" @click="pendingFilter.status = option.value">{{ option.label }}</button></div>
            <div class="filter-bar pending-filters"><label class="filter-search"><UiIcon name="search" /><input v-model="pendingFilter.keyword" type="search" aria-label="搜索待处理" placeholder="搜索项目、事项或文件"></label><select v-model="pendingFilter.projectId" aria-label="项目"><option value="">全部项目</option><option v-for="option in pendingProjectOptions" :key="option.id" :value="option.id">{{ option.name }}</option></select><select v-model="pendingFilter.customer" aria-label="客户"><option value="">全部客户</option><option v-for="customer in pendingCustomerOptions" :key="customer" :value="customer">{{ customer }}</option></select><select v-model="pendingFilter.owner" aria-label="经办人" title="事项经办人"><option value="">全部经办人</option><option v-for="owner in pendingOwnerOptions" :key="owner" :value="owner">{{ owner }}</option></select></div>
            <div class="list-tools"><span>共 {{ filteredPending.length }} 项</span><button v-if="pendingFiltersActive" class="link" @click="clearPendingFilters">清除</button><div class="group-control"><span>分组方式</span><div class="pending-group-by segmented" role="group" aria-label="分组"><button :aria-pressed="pendingGroupBy === 'project'" :class="{ active: pendingGroupBy === 'project' }" @click="pendingGroupBy = 'project'">项目</button><button :aria-pressed="pendingGroupBy === 'owner'" :class="{ active: pendingGroupBy === 'owner' }" @click="pendingGroupBy = 'owner'">经办人</button><button :aria-pressed="pendingGroupBy === 'none'" :class="{ active: pendingGroupBy === 'none' }" @click="pendingGroupBy = 'none'">不分组</button></div></div></div>
            <div class="pending-table" tabindex="-1"><div v-if="!filteredPending.length" class="empty"><UiIcon name="clock" class="empty-icon" /><h3>{{ pendingFiltersActive ? '没有符合条件的待处理项' : itemRows.length ? '暂无待处理文件' : '暂无事项' }}</h3><button v-if="itemRows.length && pendingFiltersActive" class="button secondary" @click="clearPendingFilters">清除筛选</button><button v-else class="button secondary accent" @click="go('projects')">查看项目<UiIcon name="arrow" /></button></div><template v-else><div class="pending-table-head"><span>文件</span><span>项目及事项</span><span>待办状态</span><span title="事项经办人">经办人</span></div><section v-for="group in pendingGroups" :key="`${pendingGroupBy}:${group.key}`" class="pending-group"><h2 v-if="pendingGroupBy !== 'none'" class="pending-group-head"><span>{{ group.label }}</span><span class="pending-group-count">{{ group.rows.length }} 项</span></h2><button v-for="row in group.rows" :key="row.item.id" class="pending-row" @click="openEvent(row.project, row.event)"><span class="pending-file"><UiIcon name="file" /><strong>{{ row.item.name }}</strong></span><span><strong>{{ row.project.name }}</strong><small>{{ row.project.customer }} · {{ row.event.name }}</small></span><span class="pending-gaps"><span v-for="gap in row.gaps" :key="gap" class="tag orange">{{ gap }}</span><span v-if="!row.gaps.length" class="tag green">已完成</span></span><span>{{ row.event.owner }}</span></button></section></template></div>
          </section>

          <section v-else-if="view === 'templates'" class="page-section library-page">
            <div class="page-heading"><h1>文件库</h1><div class="heading-actions"><button class="button secondary" @click="openCategoryModal()">新建分类</button><button class="button primary" @click="openTemplateModal()"><UiIcon name="plus" />添加文件模板</button></div></div>
            <div class="library-note"><UiIcon name="info" /><span>待办清单由各事项单独管理。</span></div>
            <div class="filter-bar library-filters"><label class="filter-search"><UiIcon name="search" /><input v-model="librarySearch" type="search" aria-label="搜索文件模板" placeholder="搜索文件模板"></label><div class="category-filters" role="group" aria-label="文件分类"><button :class="{ active: libraryCategory === null }" :aria-pressed="libraryCategory === null" @click="libraryCategory = null">全部 {{ snapshot.templates.length }}</button><button :class="{ active: libraryCategory === '' }" :aria-pressed="libraryCategory === ''" @click="libraryCategory = ''">未分类 {{ snapshot.templates.filter(file => !file.categoryId).length }}</button><button v-for="category in snapshot.categories" :key="category.id" :aria-pressed="libraryCategory === category.id" :class="{ active: libraryCategory === category.id }" @click="libraryCategory = category.id">{{ category.name }} {{ snapshot.templates.filter(file => file.categoryId === category.id).length }}</button></div><ActionMenu v-if="selectedCategory" label="分类操作"><button @click="openCategoryModal(selectedCategory)">重命名</button><button class="danger" @click="deleteCategory(selectedCategory!)">删除分类</button></ActionMenu></div>
            <div class="table-wrap"><table class="library-table"><thead><tr><th>模板名称</th><th>分类</th><th>模板文件</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="file in filteredLibrary" :key="file.id"><td><div class="library-name"><span class="file-tile"><UiIcon name="file" /></span><button class="title-button" :title="file.purpose || file.name" @click="openTemplateModal(file)">{{ file.name }}</button></div></td><td><span class="tag neutral">{{ categoryName(file.categoryId) }}</span></td><td><span v-for="asset in file.assets" :key="asset.id" class="library-asset" :title="asset.path"><UiIcon name="file" />{{ asset.name }}</span><span v-if="!file.assets.length" class="muted">未导入</span></td><td><span class="availability" :class="{ ok: templateStatus(file) === '可用', warning: templateStatus(file) === '失效' }"><i></i>{{ templateStatus(file) }}</span></td><td><div class="inline-actions"><button class="button secondary small" :disabled="busy || !file.assets.length || file.assets.some(asset => !asset.exists)" @click="exportTemplate(file)">导出</button><ActionMenu :label="`${file.name}操作`" :disabled="busy"><button @click="openTemplateModal(file)"><UiIcon name="edit" />编辑模板</button><button @click="importTemplateAssets(file)"><UiIcon name="upload" />导入模板</button><button v-for="asset in file.assets" :key="asset.id" @click="removeTemplateAsset(asset.id)"><UiIcon name="file" />{{ file.assets.length > 1 ? `移除 ${asset.name}` : '移除模板文件' }}</button><hr><button class="danger" @click="deleteTemplate(file)">删除模板</button></ActionMenu></div></td></tr></tbody></table></div>
            <div v-if="!filteredLibrary.length" class="empty"><UiIcon name="library" class="empty-icon" /><h3>{{ snapshot.templates.length ? '没有符合条件的模板' : '文件库还没有文件' }}</h3><button v-if="librarySearch || libraryCategory !== null" class="button secondary" @click="librarySearch = ''; libraryCategory = null">清除筛选</button></div><div class="list-footer">共 {{ filteredLibrary.length }} 个模板</div>
          </section>

          <section v-else-if="view === 'settings'" class="page-section settings-page">
            <div class="page-heading"><h1>设置</h1></div><nav class="status-tabs settings-nav" aria-label="设置分类"><span class="active">存储</span></nav>
            <div class="settings-content"><div v-if="storageNotice" class="warning-banner" role="status"><UiIcon name="warning" /><span>{{ storageNotice }}</span></div><div v-for="location in storageKinds" :key="location.key" class="storage-row"><h2>{{ location.label }}</h2><div class="storage-control"><div class="path-field"><span :title="storageLocations[location.key]">{{ storageLocations[location.key] }}</span><button class="icon-button" :aria-label="`复制${location.label}`" :disabled="!storageLocations[location.key]" @click="copyPath(storageLocations[location.key])"><UiIcon name="copy" /></button></div><button class="button secondary" :disabled="busy" @click="chooseStorage(location.key)">更改位置</button></div></div>
              <div class="migration-notice"><UiIcon name="info" /><div><strong>更换位置前请留意</strong><p>更换后，原目录仍会保留数据文件。迁回原目录前，需要先处理旧数据文件。</p><details><summary>查看迁移说明<UiIcon name="back" /></summary><p>更换位置后会保留原目录中的 workpack-v3.sqlite。迁回原目录前，请先备份并移走该文件及同名的 -wal、-shm 文件，再选择原目录。</p></details></div></div>
            </div>
          </section>

          <section v-else-if="view === 'project' && activeProject" class="page-section project-detail">
            <div class="detail-heading"><div class="detail-title-row"><h1>{{ activeProject.name }}</h1><div class="heading-actions"><button class="button secondary" @click="openProjectModal(activeProject)"><UiIcon name="edit" />编辑项目</button><ActionMenu label="项目操作" :disabled="busy"><button @click="openProjectFolder(activeProject)"><UiIcon name="project" />打开文件夹</button><button v-if="!activeProject.folderExists" @click="relocateProject(activeProject)">重新定位</button><button class="danger" @click="deleteProject(activeProject)">删除项目</button></ActionMenu></div></div><div class="project-metadata"><span class="owner-avatar">{{ activeProject.owner.slice(0, 1) }}</span><span>负责人 {{ activeProject.owner }}</span><span v-if="activeProject.customer" class="customer-name">{{ activeProject.customer }}</span><span v-if="activeProject.contact">{{ activeProject.contact }}</span></div><p v-if="activeProject.note" class="project-note">{{ activeProject.note }}</p></div>
            <div v-if="!activeProject.folderExists" class="warning-banner"><UiIcon name="warning" /><span>项目目录不可用</span><button class="button secondary small" @click="relocateProject(activeProject)">重新定位</button></div>
            <div class="project-overview-grid"><article><span>整体资料进度</span><strong>{{ projectProgress(activeProject).percent }}%</strong><div class="progress-track"><i :style="{ width: `${projectProgress(activeProject).percent}%` }"></i></div></article><article><span>文件清单</span><strong>{{ activeProject.events.reduce((total, event) => total + event.items.length, 0) }} 个</strong></article><article><span>业务事项</span><strong>{{ activeProject.events.length }} 个</strong></article></div>
            <div class="project-body"><div class="event-list-section" tabindex="-1"><div class="section-heading"><div class="title-with-count"><h2>业务事项</h2><span class="count-badge">{{ activeProject.events.length }}</span></div><button class="button primary" @click="openEventModal(activeProject)"><UiIcon name="plus" />新建事项</button></div><div v-if="!activeProject.events.length" class="empty"><UiIcon name="event" class="empty-icon" /><h3>从第一件事项开始</h3></div><div v-else class="event-cards"><article v-for="event in activeProject.events" :key="event.id" class="event-card" tabindex="0" role="button" @click="openEvent(activeProject, event)" @keydown.enter.prevent="openEvent(activeProject, event)" @keydown.space.prevent="openEvent(activeProject, event)"><div class="event-card-head"><UiIcon name="event" /><h3>{{ event.name }}</h3><span class="tag" :class="eventPending(event) || !event.items.length ? 'orange' : 'green'">{{ eventPending(event) || !event.items.length ? '未完成' : '已完成' }}</span></div><div class="event-card-meta"><span>{{ formatDate(event.date) }}</span><span>{{ event.owner }}</span><span>{{ event.items.length }} 个文件</span></div><div class="progress-meta"><div class="progress-track"><i :style="{ width: `${eventProgress(event).percent}%` }"></i></div><strong>{{ eventProgress(event).percent }}%</strong></div></article></div></div>
              <aside class="project-folder"><div class="section-heading"><h2>项目文件夹</h2></div><div class="folder-name"><UiIcon name="project" /><strong>{{ activeProject.name }}</strong></div><span class="availability" :class="activeProject.folderExists ? 'ok' : 'warning'"><i></i>{{ activeProject.folderExists ? '目录可访问' : '目录不可用' }}</span><div class="path-field"><span :title="activeProject.folder">{{ shortPath(activeProject.folder) }}</span><button class="icon-button" aria-label="复制项目路径" @click="copyPath(activeProject.folder)"><UiIcon name="copy" /></button></div><button class="button secondary" @click="openProjectFolder(activeProject)"><UiIcon name="project" />打开文件夹</button></aside>
            </div>
          </section>

        </template>
      </main>
      <div v-if="drawerOpen" class="drawer-scrim" @click="requestCloseDrawer"></div>
    </section>

    <div v-if="drawerOpen && activeProject && activeEvent" ref="drawerCard" class="event-drawer" role="dialog" aria-modal="true" aria-labelledby="event-drawer-title" :aria-hidden="modal ? 'true' : undefined" tabindex="-1" @keydown="handleDrawerKeydown">
      <div class="event-detail">
        <div class="event-actions"><button class="back-button small-back" @click="requestCloseDrawer"><UiIcon name="back" class="back-icon" />返回事项</button><button class="button secondary small" @click="openEventModal(activeProject, activeEvent)"><UiIcon name="edit" />编辑</button><ActionMenu label="事项操作" :disabled="busy"><button class="danger" @click="removeEvent(activeEvent)">删除事项</button></ActionMenu></div><div class="event-detail-heading"><div class="event-title"><h2 id="event-drawer-title">{{ activeEvent.name }}</h2><p>{{ formatDate(activeEvent.date) }} · {{ activeEvent.owner }}</p></div><div class="event-progress-large"><strong>{{ eventProgress(activeEvent).percent }}%</strong><div class="progress-track"><i :style="{ width: `${eventProgress(activeEvent).percent}%` }"></i></div></div></div><div class="checklist-heading"><div><h3>文件清单</h3></div><div class="heading-actions"><button class="button primary small" @click="openItemModal(activeEvent)"><UiIcon name="plus" />添加文件项</button></div></div><ItemChecklist :items="activeEvent.items" :busy="busy" @task="toggleTask" @add-task="openTaskModal" @remove-task="removeTask" @edit="item => openItemModal(activeEvent!, item)" @remove="removeItem" @upload="importAttachments" @open="openAttachment" @relocate="relocateAttachment" @detach="removeAttachment" />
      </div>
    </div>

    <div v-if="modal" class="modal-backdrop" @click.self="requestCloseModal"><section aria-labelledby="modal-title" ref="modalCard" class="modal-card" :class="{ 'modal-wide': modal === 'event' || modal === 'item' }" role="dialog" aria-modal="true" tabindex="-1" @keydown="handleModalKeydown">
      <template v-if="modal === 'project'"><div class="modal-heading"><div><h2 id="modal-title">{{ projectForm.id ? '编辑项目' : '新建项目' }}</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form @submit.prevent="saveProject"><fieldset class="form-grid" :disabled="busy"><label>项目名称<input v-model="projectForm.name" required maxlength="100"></label><label>客户名称<input v-model="projectForm.customer" required maxlength="100"></label><label>负责人<input v-model="projectForm.owner" required maxlength="100"></label><label>联系方式<input v-model="projectForm.contact" maxlength="4000"></label><label class="full-width">项目备注<textarea v-model="projectForm.note" rows="3" maxlength="4000"></textarea></label><div class="full-width folder-picker"><div><span class="form-label">项目存储位置</span><span class="selected-path" :title="storageLocations.project">{{ projectForm.id ? projectForm.directoryPath : storageLocations.project }}</span></div></div><div class="modal-actions"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : '保存' }}</button></div></fieldset></form></template>

      <template v-else-if="modal === 'event'"><div class="modal-heading"><div><h2 id="modal-title">{{ eventForm.id ? '编辑业务事项' : '新建业务事项' }}</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form @submit.prevent="saveEvent"><fieldset class="form-grid" :disabled="busy"><label class="full-width">事项名称<input v-model="eventForm.name" required maxlength="100"></label><fieldset class="full-width"><legend>需要的模板文件</legend><div class="template-checks"><label v-for="file in snapshot.templates" :key="file.id" class="template-check"><input v-model="eventForm.templateIds" type="checkbox" :value="file.id" :disabled="Boolean(eventForm.id)"><span class="template-icon"><UiIcon name="file" /></span><span><strong>{{ file.name }}</strong><small v-if="file.purpose">{{ file.purpose }}</small></span></label><span v-if="!snapshot.templates.length" class="form-help">请先在文件库添加模板。</span></div></fieldset><label>日期<input v-model="eventForm.date" required type="date"></label><label>经办人<input v-model="eventForm.owner" required maxlength="100"></label><div class="modal-actions full-width"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : eventForm.id ? '保存' : '创建' }}</button></div></fieldset></form></template>

      <template v-else-if="modal === 'template'"><div class="modal-heading"><div><h2 id="modal-title">{{ templateForm.id ? '编辑文件模板' : '添加文件模板' }}</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form @submit.prevent="saveTemplate"><fieldset class="form-grid" :disabled="busy"><label class="full-width">文件名称<input v-model="templateForm.name" required maxlength="100"></label><label class="full-width">用途说明<textarea v-model="templateForm.purpose" rows="3" maxlength="4000"></textarea></label><label class="full-width">分类<select v-model="templateForm.categoryId"><option value="">未分类</option><option v-for="category in snapshot.categories ?? []" :key="category.id" :value="category.id">{{ category.name }}</option></select></label><div class="modal-actions full-width"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">保存</button></div></fieldset></form></template>
      <template v-else-if="modal === 'category'"><div class="modal-heading"><div><h2 id="modal-title">{{ categoryForm.id ? '编辑分类' : '新建分类' }}</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form @submit.prevent="saveCategory"><fieldset class="form-grid" :disabled="busy"><label class="full-width">分类名称<input v-model="categoryForm.name" required maxlength="100"></label><div class="modal-actions full-width"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">保存</button></div></fieldset></form></template>
      <template v-else-if="modal === 'task'"><div class="modal-heading"><div><h2 id="modal-title">添加待办</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form @submit.prevent="saveTask"><fieldset class="form-grid" :disabled="busy"><label class="full-width">待办名称<input v-model="taskForm.name" required maxlength="100"></label><div class="modal-actions full-width"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">添加</button></div></fieldset></form></template>

      <template v-else-if="modal === 'item'"><div class="modal-heading"><div><h2 id="modal-title">{{ itemForm.id ? '编辑清单项' : '添加文件项' }}</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form @submit.prevent="saveItem"><fieldset class="form-grid" :disabled="busy"><label class="full-width">文件名称<input v-model="itemForm.name" required maxlength="100"></label><label class="full-width">文件说明<textarea v-model="itemForm.note" rows="3" maxlength="4000"></textarea></label><div class="modal-actions"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : '保存' }}</button></div></fieldset></form></template>
    </section></div>
    <footer class="app-footer" aria-hidden="true"><span class="footer-emblem"><img :src="workpackLogo" alt=""></span></footer>
    <div v-if="toast.visible" class="toast" :class="toast.tone" :role="toast.tone === 'error' ? 'alert' : 'status'"><span><UiIcon :name="toast.tone === 'success' ? 'check' : 'error'" /></span>{{ toast.message }}<button v-if="toast.tone === 'error'" class="toast-close" aria-label="关闭错误提示" @click="clearToast"><UiIcon name="close" /></button></div>
  </div>
</template>
