<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import ItemChecklist from './components/ItemChecklist.vue'
import NavIcon from './components/NavIcon.vue'
import UiIcon from './components/UiIcon.vue'
import RulesEditor from './components/RulesEditor.vue'
import {
  gaps,
  progress,
  stepLabels,
  steps,
  type BusinessEvent,
  type Item,
  type Project,
  type Rule,
  type Snapshot,
  type Status,
  type Step,
  type Template
} from '../../shared/model'

type MainView = 'home' | 'projects' | 'pending' | 'templates' | 'project'
type ModalName = 'project' | 'event' | 'template' | 'item' | null

const emptySnapshot = (): Snapshot => ({ projects: [], templates: [], dataDirectory: '' })
const snapshot = ref<Snapshot>(emptySnapshot())
const view = ref<MainView>('home')
const activeProjectId = ref<string | null>(null)
const activeEventId = ref<string | null>(null)
const activeEventOnly = ref(false)
const loading = ref(true)
const busy = ref(false)
const errorMessage = ref('')
const search = ref('')
const projectFilter = reactive({ keyword: '', status: 'all' as 'all' | 'open' | 'done' })
const pendingFilter = reactive({ keyword: '' })
const modal = ref<ModalName>(null)
const toast = ref({ visible: false, message: '', tone: 'success' as 'success' | 'error' })
let toastTimer: ReturnType<typeof setTimeout> | undefined
const modalCard = ref<HTMLElement | null>(null)
const modalBaseline = ref('')
const savedItemId = ref('')
const savedEventId = ref('')
let inlineFeedbackTimer: ReturnType<typeof setTimeout> | undefined

const projectForm = reactive({ id: '', name: '', customer: '', contact: '', owner: '', note: '', templateIds: [] as string[], directoryToken: '', directoryPath: '' })
const eventForm = reactive({ id: '', projectId: '', templateId: '', name: '', date: new Date().toISOString().slice(0, 10), owner: '' })
const templateForm = reactive({ id: '', name: '', rules: [] as Rule[] })
const itemForm = reactive({ id: '', eventId: '', name: '', note: '', required: [...steps] as Step[] })

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
    const workflowNames = project.templateIds.map(id => templateFor(id)?.name ?? '')
    const matchesKeyword = !keyword || [project.name, project.customer, project.owner, ...workflowNames].some(value => value.toLowerCase().includes(keyword))
    const percent = projectProgress(project).percent
    const matchesStatus = projectFilter.status === 'all' || (projectFilter.status === 'done' ? percent === 100 && project.events.length > 0 : percent < 100 || !project.events.length)
    return matchesKeyword && matchesStatus
  })
})
const filteredPending = computed(() => {
  const keyword = pendingFilter.keyword.trim().toLowerCase()
  return pendingRows.value.filter(row => {
    const workflowName = templateFor(row.event.templateId)?.name ?? ''
    return !keyword || [row.project.name, row.project.customer, row.event.name, row.item.name, workflowName].some(value => value.toLowerCase().includes(keyword))
  })
})
const currentBreadcrumb = computed(() => {
  if (view.value !== 'project') return ({ home: '工作台', projects: '项目', pending: '待处理', templates: '流程' } as Record<Exclude<MainView, 'project'>, string>)[view.value]
  return activeProject.value?.name ?? '项目详情'
})
const modalDirty = computed(() => Boolean(modal.value && modalBaseline.value && JSON.stringify(currentModalData()) !== modalBaseline.value))

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function currentModalData() {
  if (modal.value === 'project') return clone(projectForm)
  if (modal.value === 'event') return clone(eventForm)
  if (modal.value === 'template') return clone(templateForm)
  if (modal.value === 'item') return clone(itemForm)
  return null
}
function markModalClean() { modalBaseline.value = JSON.stringify(currentModalData()) }
function clearToast() {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value.visible = false
}
function requestCloseModal() {
  if (modalDirty.value && !window.confirm('有未保存修改，关闭？')) return
  clearToast()
  modal.value = null
}
function focusableModalElements() {
  return Array.from(modalCard.value?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
}
function handleModalKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); requestCloseModal(); return }
  if (event.key !== 'Tab') return
  const elements = focusableModalElements()
  if (!elements.length) return
  const first = elements[0], last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
function focusModal() {
  nextTick(() => {
    const firstField = modalCard.value?.querySelector<HTMLElement>('form input:not([disabled]), form textarea:not([disabled]), form select:not([disabled])')
    ;(firstField ?? focusableModalElements()[0])?.focus()
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
function showInlineFeedback(eventId: string, itemId = '') {
  savedEventId.value = eventId
  savedItemId.value = itemId
  if (inlineFeedbackTimer) clearTimeout(inlineFeedbackTimer)
  inlineFeedbackTimer = setTimeout(() => { savedEventId.value = ''; savedItemId.value = '' }, 1800)
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
function templateFor(id: string) { return snapshot.value.templates.find(template => template.id === id) }
const templateFormAssets = computed(() => snapshot.value.templates.find(template => template.id === templateForm.id)?.assets ?? [])
function projectProgress(project: Project) { return progress(project.events.flatMap(event => event.items)) }
function eventProgress(event: BusinessEvent) { return progress(event.items) }
function eventPending(event: BusinessEvent) { return event.items.filter(item => gaps(item).length).length }
function projectActivity(project: Project) { return project.events.reduce((latest, event) => event.date > latest ? event.date : latest, '') }
function statusText(status: Status, step: Step) { return status === 'done' ? `已${stepLabels[step]}` : status === 'na' ? '不适用' : `待${stepLabels[step]}` }
function todayLabel() { return new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) }

async function refresh(showLoading: boolean | Event = true) {
  if (showLoading) loading.value = true
  errorMessage.value = ''
  try {
    snapshot.value = await window.workpack.snapshot()
    snapshot.value.projects.sort((a, b) => projectActivity(b).localeCompare(projectActivity(a)))
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
  if (next !== 'project') { activeProjectId.value = null; activeEventId.value = null; activeEventOnly.value = false }
}
function openProject(project: Project, eventId?: string) {
  clearToast()
  activeProjectId.value = project.id
  activeEventId.value = eventId ?? null
  activeEventOnly.value = Boolean(eventId)
  view.value = 'project'
}
function openEvent(project: Project, event: BusinessEvent) { openProject(project, event.id) }
function closeEventDetail() { clearToast(); activeEventId.value = null; activeEventOnly.value = false }
function runGlobalSearch() {
  clearToast()
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) { go('projects'); return }
  const project = snapshot.value.projects.find(item => [item.name, item.customer, item.owner, ...item.templateIds.map(id => templateFor(id)?.name ?? '')].some(value => value.toLowerCase().includes(keyword)))
  if (project) { openProject(project); return }
  const row = itemRows.value.find(item => [item.event.name, templateFor(item.event.templateId)?.name ?? '', item.item.name, ...item.item.attachments.map(attachment => attachment.name)].some(value => value.toLowerCase().includes(keyword)))
  if (row) { openEvent(row.project, row.event); return }
  showToast('没有找到匹配的项目或文件', 'error')
}

function resetProjectForm(project?: Project) {
  Object.assign(projectForm, project ? { id: project.id, name: project.name, customer: project.customer, contact: project.contact, owner: project.owner, note: project.note, templateIds: [...project.templateIds], directoryToken: '', directoryPath: project.folder } : { id: '', name: '', customer: '', contact: '', owner: '', note: '', templateIds: [], directoryToken: '', directoryPath: '' })
}
function openProjectModal(project?: Project) { clearToast(); resetProjectForm(project); modal.value = 'project'; markModalClean() }
async function chooseProjectFolder() {
  clearToast()
  try {
    const result = await window.workpack.chooseDirectory()
    if (result) { projectForm.directoryToken = result.token; projectForm.directoryPath = result.path }
  } catch (error) { showToast(error instanceof Error ? error.message : '无法选择文件夹', 'error') }
}
async function saveProject() {
  if (!projectForm.name.trim() || !projectForm.customer.trim() || !projectForm.owner.trim()) { showToast('请填写项目名称、客户和负责人', 'error'); return }
  if (!projectForm.id && !projectForm.directoryToken) { showToast('请先选择项目上级文件夹', 'error'); return }
  const input = { id: projectForm.id || undefined, name: projectForm.name, customer: projectForm.customer, contact: projectForm.contact, owner: projectForm.owner, note: projectForm.note, templateIds: [...projectForm.templateIds], directoryToken: projectForm.directoryToken || undefined }
  const saved = await run(() => window.workpack.saveProject(input), '已保存')
  if (typeof saved !== 'string') return
  modal.value = null
  const project = snapshot.value.projects.find(item => item.id === saved)
  if (project) openProject(project)
}

function resetEventForm(project: Project, event?: BusinessEvent) { Object.assign(eventForm, event ? { id: event.id, projectId: project.id, templateId: event.templateId, name: event.name, date: event.date, owner: event.owner } : { id: '', projectId: project.id, templateId: project.templateIds[0] ?? '', name: '', date: new Date().toISOString().slice(0, 10), owner: project.owner }) }
function openEventModal(project = activeProject.value, event?: BusinessEvent) { if (!project) return; clearToast(); resetEventForm(project, event); modal.value = 'event'; markModalClean() }
async function saveEvent() {
  if (!eventForm.name.trim() || !eventForm.templateId || !eventForm.owner.trim()) { showToast('请填写事项名称、模板和经办人', 'error'); return }
  const input = { id: eventForm.id, projectId: eventForm.projectId, templateId: eventForm.templateId, name: eventForm.name, date: eventForm.date, owner: eventForm.owner }
  const saved = eventForm.id
    ? await run(() => window.workpack.updateEvent(input), '已保存')
    : await run(() => window.workpack.createEvent(input), '已保存')
  if (!saved) return
  modal.value = null
  const project = snapshot.value.projects.find(item => item.id === eventForm.projectId)
  const eventId = typeof saved === 'string' ? saved : eventForm.id || undefined
  if (project) openProject(project, eventId)
}

function resetTemplateForm(template?: Template) {
  Object.assign(templateForm, template ? { id: template.id, name: template.name, rules: clone(template.rules) } : { id: '', name: '', rules: [] })
}
function openTemplateModal(template?: Template) { clearToast(); resetTemplateForm(template); modal.value = 'template'; markModalClean() }
async function saveTemplate() {
  if (!templateForm.name.trim() || !templateForm.rules.every(rule => rule.name.trim())) { showToast('请填写流程名称及文件项名称', 'error'); return }
  const saved = await run(() => window.workpack.saveTemplate({ id: templateForm.id || undefined, name: templateForm.name, rules: clone(templateForm.rules) }), '已保存')
  if (saved) modal.value = null
}
async function deleteTemplate(template: Template) {
  if (!window.confirm(`删除流程“${template.name}”？流程和模板文件记录会删除，已创建事项及磁盘上的实际文件会保留。`)) return
  await run(() => window.workpack.deleteTemplate(template.id), '已删除')
}
async function deleteProject(project: Project) {
  const confirmed = window.confirm(`“${project.name}”的事项、清单及附件记录将被删除。项目文件夹和实际文件会保留。`)
  if (!confirmed) return
  const removed = await run(() => window.workpack.deleteProject(project.id), '已删除，文件夹已保留')
  if (removed) {
    activeProjectId.value = null
    activeEventId.value = null
    activeEventOnly.value = false
    go('projects')
  }
}
async function importTemplateAssets(template: Template) {
  const saved = await run(() => window.workpack.importTemplates(template.id), '已导入')
  if (saved !== false) {
    const latest = snapshot.value.templates.find(candidate => candidate.id === template.id)
    if (latest) openTemplateModal(latest)
  }
}
async function removeTemplateAsset(assetId: string) {
  if (!window.confirm('移除模板文件记录？原文件不会删除。')) return
  await run(() => window.workpack.removeTemplateAsset(assetId), '已移除')
}
async function exportTemplate(template: Template) {
  await run(() => window.workpack.exportTemplates(template.assets.map(asset => asset.id)), '已导出')
}

function resetItemForm(event: BusinessEvent, item?: Item) { Object.assign(itemForm, item ? { id: item.id, eventId: event.id, name: item.name, note: item.note, required: [...item.required] } : { id: '', eventId: event.id, name: '', note: '', required: [...steps] }) }
function openItemModal(event: BusinessEvent, item?: Item) { clearToast(); resetItemForm(event, item); modal.value = 'item'; markModalClean() }
async function saveItem() {
  if (!itemForm.name.trim() || !itemForm.required.length) { showToast('请填写文件名称，并至少选择一个完成步骤', 'error'); return }
  const saved = await run(() => window.workpack.saveItem({ id: itemForm.id || undefined, eventId: itemForm.eventId, name: itemForm.name, note: itemForm.note, required: [...itemForm.required] }), '已保存')
  if (saved) modal.value = null
}
async function removeItem(item: Item) {
  if (!window.confirm(`删除清单项“${item.name}”？附件记录也会移除。`)) return
  await run(() => window.workpack.deleteItem(item.id), '已删除')
}
async function removeEvent(event: BusinessEvent) {
  if (!window.confirm(`删除事项“${event.name}”？清单记录会被删除，工作副本会保留。`)) return
  const removed = await run(() => window.workpack.deleteEvent(event.id), '已删除')
  if (removed) closeEventDetail()
}
async function setItemStatus(id: string, step: Step, status: Status) {
  const item = snapshot.value.projects.flatMap(project => project.events.flatMap(event => event.items)).find(candidate => candidate.id === id)
  const result = await run(() => window.workpack.setStatus({ id, step, status }))
  if (result !== false && item) showInlineFeedback(item.eventId, id)
}
async function completeItem(id: string) {
  const item = snapshot.value.projects.flatMap(project => project.events.flatMap(event => event.items)).find(candidate => candidate.id === id)
  const result = await run(() => window.workpack.completeItem(id))
  if (result !== false && item) showInlineFeedback(item.eventId, id)
}
async function completeEvent(event: BusinessEvent) {
  const result = await run(() => window.workpack.completeEvent(event.id))
  if (result !== false) showInlineFeedback(event.id)
}
async function importAttachments(id: string) { await run(() => window.workpack.importAttachments(id), '上传完成') }
async function openAttachment(id: string) { await run(() => window.workpack.openAttachment(id)) }
async function relocateAttachment(id: string) { await run(() => window.workpack.relocateAttachment(id), '已重新关联') }
async function removeAttachment(id: string) { if (window.confirm('移除附件记录？原文件不会删除。')) await run(() => window.workpack.removeAttachment(id), '已移除') }
async function openProjectFolder(project: Project) { await run(() => window.workpack.openProject(project.id)) }
async function relocateProject(project: Project) { const moved = await run(() => window.workpack.relocateProject(project.id), '已重新定位'); if (moved) await refresh() }

watch(modal, value => {
  if (value) focusModal()
  else modalBaseline.value = ''
})
onMounted(() => {
  refresh()
  document.addEventListener('click', handleModalClick, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleModalClick, true)
  if (inlineFeedbackTimer) clearTimeout(inlineFeedbackTimer)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark"><span></span><span></span><span></span></div><strong>WorkPack</strong></div>
      <div class="workspace-switch"><span class="workspace-avatar">W</span><span>我的工作空间</span><b>⌄</b></div>
      <nav class="nav" aria-label="主导航">
        <button type="button" :class="{ active: view === 'home' }" @click="go('home')"><NavIcon class="nav-icon" name="home" />工作台</button>
        <button type="button" :class="{ active: view === 'projects' || view === 'project' }" @click="go('projects')"><NavIcon class="nav-icon" name="projects" />项目</button>
        <button type="button" :class="{ active: view === 'pending' }" @click="go('pending')"><NavIcon class="nav-icon" name="pending" />待处理 <span v-if="navPending" class="nav-count">{{ navPending }}</span></button>
        <button type="button" :class="{ active: view === 'templates' }" @click="go('templates')"><NavIcon class="nav-icon" name="templates" />流程</button>
      </nav>
      <div class="sidebar-bottom"><div class="sidebar-user"><span class="user-avatar">陈</span><span><strong>本机用户</strong><small>项目负责人</small></span></div></div>
    </aside>

    <section class="content-shell">
      <header class="topbar"><div class="breadcrumb"><span v-if="view === 'project'" class="breadcrumb-link" @click="go('projects')">项目</span><span v-if="view === 'project'" class="breadcrumb-divider">/</span>{{ currentBreadcrumb }}</div><div class="topbar-actions"><label class="global-search"><UiIcon name="search" class="search-icon" /><input v-model="search" type="search" placeholder="搜索项目或客户" aria-label="搜索项目或客户" @keyup.enter="runGlobalSearch"><kbd>↵</kbd></label><span class="today-label">{{ todayLabel() }}</span><span class="top-avatar">陈</span></div></header>

      <main class="view">
        <div v-if="loading" class="loading-state"><span class="spinner"></span><p>加载中…</p></div>
        <div v-else-if="errorMessage" class="error-state"><div class="empty-icon"><UiIcon name="error" /></div><h2>读取失败</h2><p>{{ errorMessage }}</p><button class="button primary" @click="refresh">重试</button></div>

        <template v-else>
          <section v-if="view === 'home'" class="page-section">
            <div class="page-heading"><div><span class="eyebrow">WORKSPACE OVERVIEW</span><h1>工作台</h1></div><div class="heading-actions"><button class="button secondary" @click="go('templates')">流程</button><button class="button primary" @click="openProjectModal()">新建项目</button></div></div>
            <div class="stat-grid"><article class="stat-card"><span class="stat-icon violet"><UiIcon name="project" /></span><div><span>项目</span><strong>{{ snapshot.projects.length }}</strong></div></article><article class="stat-card"><span class="stat-icon orange"><UiIcon name="clock" /></span><div><span>待处理</span><strong>{{ navPending }}</strong></div></article><article class="stat-card"><span class="stat-icon blue"><UiIcon name="event" /></span><div><span>未完成事项</span><strong>{{ openEvents.length }}</strong></div></article><article class="stat-card"><span class="stat-icon green"><UiIcon name="workflow" /></span><div><span>流程</span><strong>{{ snapshot.templates.length }}</strong></div></article></div>
            <div class="home-grid"><section class="panel attention-panel"><div class="panel-heading"><div><h2>需要关注</h2></div><button class="link" @click="go('pending')">查看全部</button></div><div v-if="!pendingRows.length" class="empty compact"><div class="empty-icon"><UiIcon name="check" /></div><strong>{{ allEvents.length ? '已完成' : '暂无事项' }}</strong></div><button v-for="row in pendingRows.slice(0, 5)" :key="row.item.id" class="attention-row" @click="openEvent(row.project, row.event)"><span class="attention-dot"></span><span class="attention-main"><strong>{{ row.item.name }}</strong><small>{{ row.project.name }} · {{ row.event.name }}</small></span><span class="attention-tags"><span v-for="gap in row.gaps.slice(0, 2)" :key="gap" class="tag orange">{{ gap }}</span></span></button></section><section class="panel recent-panel"><div class="panel-heading"><div><h2>最近项目</h2></div><button class="link" @click="go('projects')">全部项目</button></div><div v-if="!snapshot.projects.length" class="empty compact"><div class="empty-icon"><UiIcon name="plus" /></div><strong>暂无项目</strong></div><button v-for="project in recentProjects" :key="project.id" class="project-mini" @click="openProject(project)"><span class="project-mini-mark">{{ project.name.slice(0, 1) }}</span><span><strong>{{ project.name }}</strong><small>{{ project.customer }}</small></span><span class="mini-progress"><i :style="{ width: `${projectProgress(project).percent}%` }"></i></span><b>{{ projectProgress(project).percent }}%</b></button></section></div>
          </section>

          <section v-else-if="view === 'projects'" class="page-section"><div class="page-heading"><div><span class="eyebrow">PROJECTS</span><h1>项目</h1></div><div class="filter-bar"><label class="filter-search"><UiIcon name="search" class="search-icon" /><input v-model="projectFilter.keyword" placeholder="搜索项目、客户、负责人或流程"></label><select v-model="projectFilter.status"><option value="all">全部完成状态</option><option value="open">进行中</option><option value="done">已完成</option></select><span class="filter-result">共 {{ filteredProjects.length }} 个项目</span></div><button class="button primary" @click="openProjectModal()">新建项目</button></div><div class="project-list"><article v-for="project in filteredProjects" :key="project.id" class="project-card" tabindex="0" role="button" @click="openProject(project)" @keydown.enter.prevent="openProject(project)" @keydown.space.prevent="openProject(project)"><div class="project-card-main"><span class="project-mark">{{ project.name.slice(0, 1) }}</span><div class="project-title"><button class="title-button" @click="openProject(project)">{{ project.name }}</button><span class="project-code">{{ project.customer }}</span><p v-if="project.note">{{ project.note }}</p><small class="project-workflows">{{ project.templateIds.map(id => templateFor(id)?.name).filter(Boolean).join('、') || '未设置流程' }}</small></div><div class="project-owner"><small>负责人</small><strong>{{ project.owner }}</strong></div><div class="project-progress"><div class="progress-meta"><span>资料进度</span><strong>{{ projectProgress(project).percent }}%</strong></div><div class="progress-track"><i :style="{ width: `${projectProgress(project).percent}%` }"></i></div><small>{{ projectProgress(project).done }} / {{ projectProgress(project).total || 0 }} 个必要步骤</small></div></div><div class="project-card-footer"><span>事项 {{ project.events.length }} 个</span><span>待处理 {{ project.events.reduce((sum, event) => sum + eventPending(event), 0) }} 项</span><span class="folder-status" :class="project.folderExists ? 'ok' : 'warning'"><UiIcon :name="project.folderExists ? 'check' : 'warning'" />{{ project.folderExists ? '项目目录正常' : '项目目录需要重新定位' }}</span><button class="link danger-link project-delete" @click.stop="deleteProject(project)">删除</button><button class="link" @click.stop="openProjectFolder(project)">打开文件夹</button></div></article><div v-if="!filteredProjects.length" class="empty"><div class="empty-icon"><UiIcon name="search" /></div><h3>暂无项目</h3><p>调整筛选或新建项目。</p></div></div></section>

          <section v-else-if="view === 'pending'" class="page-section"><div class="page-heading"><div><span class="eyebrow">FOLLOW UP</span><h1>待处理</h1></div><div class="filter-bar"><label class="filter-search"><UiIcon name="search" class="search-icon" /><input v-model="pendingFilter.keyword" placeholder="搜索项目、事项、文件或流程"></label></div><div class="summary-pill"><strong>{{ filteredPending.length }}</strong><span>项</span></div></div><div class="pending-table panel"><div v-if="!filteredPending.length" class="empty"><div class="empty-icon"><UiIcon name="check" /></div><h3>已完成</h3></div><div v-else class="pending-table-head"><span>文件</span><span>项目及事项</span><span>缺口</span><span>负责人</span></div><button v-for="row in filteredPending" :key="row.item.id" class="pending-row" @click="openEvent(row.project, row.event)"><span class="pending-file"><span class="file-icon"><UiIcon name="file" /></span><strong>{{ row.item.name }}</strong></span><span><strong>{{ row.project.name }}</strong><small>{{ templateFor(row.event.templateId)?.name || '流程已删除' }} · {{ row.event.name }}</small></span><span class="pending-gaps"><span v-for="gap in row.gaps" :key="gap" class="tag orange">{{ gap }}</span></span><span>{{ row.event.owner }}</span></button></div></section>

          <section v-else-if="view === 'templates'" class="page-section"><div class="page-heading"><div><span class="eyebrow">TEMPLATE LIBRARY</span><h1>流程</h1></div><button class="button primary" @click="openTemplateModal()">新建流程</button></div><div class="notice-banner"><span class="notice-icon"><UiIcon name="info" /></span><span>流程中的模板文件保存在本机数据目录；新建事项会复制当前规则，修改流程不影响已有事项。</span></div><div class="template-grid"><article v-for="template in snapshot.templates" :key="template.id" class="template-card"><div class="template-card-head"><span class="template-icon"><UiIcon name="workflow" /></span><div><h2>{{ template.name }}</h2></div><button class="more-button" :aria-label="`编辑${template.name}`" @click="openTemplateModal(template)">编辑</button></div><div class="template-stats"><span><strong>{{ template.rules.length }}</strong> 个文件项</span><span><strong>{{ template.assets.length }}</strong> 个模板文件</span></div><div class="rule-preview"><span v-for="rule in template.rules.slice(0, 3)" :key="rule.id">{{ rule.name }}<small>{{ rule.required.length }} 个步骤</small></span><span v-if="template.rules.length > 3" class="more-rules">+{{ template.rules.length - 3 }} 项</span></div><div class="asset-area"><div class="asset-heading"><strong>模板文件</strong><span>{{ template.assets.filter(asset => asset.exists).length }}/{{ template.assets.length }} 可用</span></div><div v-if="!template.assets.length" class="asset-empty">未导入文件</div><div v-for="asset in template.assets" :key="asset.id" class="asset-row"><span class="file-icon"><UiIcon name="file" /></span><span class="asset-name" :title="asset.path">{{ asset.name }}</span><span :class="asset.exists ? 'asset-ok' : 'asset-missing'">{{ asset.exists ? '可用' : '失效' }}</span><button class="asset-remove" title="移除记录" aria-label="移除模板文件记录" @click="removeTemplateAsset(asset.id)"><UiIcon name="close" /></button></div></div><div class="template-actions"><button class="button secondary small" @click="importTemplateAssets(template)">导入</button><button class="button secondary small" :disabled="!template.assets.length" @click="exportTemplate(template)">导出</button><button class="button danger-link small" @click="deleteTemplate(template)">删除</button></div></article><div v-if="!snapshot.templates.length" class="empty"><div class="empty-icon"><UiIcon name="workflow" /></div><h3>暂无流程</h3></div></div></section>

          <section v-else-if="view === 'project' && activeProject" class="page-section project-detail"><div class="detail-heading"><button class="back-button" @click="go('projects')"><UiIcon name="back" class="back-icon" />项目</button><div class="detail-title-row"><div><span class="eyebrow">PROJECT DETAIL</span><h1>{{ activeProject.name }}</h1><p>{{ activeProject.customer }}<span class="dot-separator">·</span>{{ activeProject.owner }} 负责</p></div><div class="heading-actions"><button class="button secondary" @click="openProjectFolder(activeProject)">打开文件夹</button><button class="button secondary" @click="openProjectModal(activeProject)">编辑</button><button class="button danger-link" @click="deleteProject(activeProject)">删除</button><button class="button primary" @click="openEventModal(activeProject)">新建事项</button></div></div></div><div v-if="!activeProject.folderExists" class="warning-banner"><UiIcon name="warning" class="warning-icon" /><span>项目目录已失效或被移动。请重新定位原项目文件夹，恢复附件和模板文件访问。</span><button class="button warning small" @click="relocateProject(activeProject)">重新定位</button></div><div class="project-overview-grid"><article><span>项目负责人</span><strong>{{ activeProject.owner }}</strong><small v-if="activeProject.contact && activeProject.contact !== activeProject.owner">{{ activeProject.contact }}</small></article><article><span>整体资料进度</span><strong>{{ projectProgress(activeProject).percent }}%</strong></article><article><span>流程</span><strong>{{ activeProject.templateIds.map(id => templateFor(id)?.name).filter(Boolean).join('、') || '未设置' }}</strong></article><article><span>项目文件夹</span><strong class="folder-value" :title="activeProject.folder">{{ activeProject.folder }}</strong><small :class="activeProject.folderExists ? 'text-success' : 'text-warning'">{{ activeProject.folderExists ? '目录可访问' : '目录不可用' }}</small></article></div><div v-if="activeEvent && activeEventOnly" class="event-detail panel"><div class="event-detail-heading"><div><div class="event-actions"><button class="back-button small-back" @click="closeEventDetail"><UiIcon name="back" class="back-icon" />返回事项</button><button class="button secondary small" @click="openEventModal(activeProject, activeEvent)">编辑</button><button class="button danger-link small" @click="removeEvent(activeEvent)">删除</button></div><div class="event-title"><span class="event-type-icon"><UiIcon name="event" /></span><div><span class="event-meta">{{ templateFor(activeEvent.templateId)?.name || '流程已删除' }} · {{ formatFullDate(activeEvent.date) }}</span><h2>{{ activeEvent.name }}</h2><p>经办人：{{ activeEvent.owner }}</p></div></div></div><div class="event-progress-large"><strong>{{ eventProgress(activeEvent).percent }}%</strong><span>完成度</span><div class="progress-track"><i :style="{ width: `${eventProgress(activeEvent).percent}%` }"></i></div></div></div><div class="checklist-heading"><div><h3>文件清单</h3><p>准备步骤需有文件。</p></div><div class="heading-actions"><span v-if="savedEventId === activeEvent.id" class="inline-saved">已保存可用步骤</span><button class="button secondary small" :disabled="busy || !activeEvent.items.length" @click="completeEvent(activeEvent)">完成可用步骤</button><button class="button secondary small" @click="openItemModal(activeEvent)">添加文件项</button></div></div><ItemChecklist :items="activeEvent.items" :busy="busy" :saved-item-id="savedItemId" @status="setItemStatus" @complete="completeItem" @edit="item => openItemModal(activeEvent!, item)" @remove="removeItem" @upload="importAttachments" @open="openAttachment" @relocate="relocateAttachment" @detach="removeAttachment" /></div><div v-else class="event-list-section"><div class="section-heading"><div><h2>业务事项</h2></div><span class="section-count">{{ activeProject.events.length }} 个事项</span></div><div v-if="!activeProject.events.length" class="empty panel"><div class="empty-icon"><UiIcon name="event" /></div><h3>暂无事项</h3><button class="button primary" @click="openEventModal(activeProject)">新建事项</button></div><div v-else class="event-cards"><article v-for="event in activeProject.events" :key="event.id" class="event-card" tabindex="0" role="button" @click="openEvent(activeProject, event)" @keydown.enter.prevent="openEvent(activeProject, event)" @keydown.space.prevent="openEvent(activeProject, event)"><div class="event-card-head"><span class="event-type-icon"><UiIcon name="event" /></span><div><span class="event-meta">{{ templateFor(event.templateId)?.name || '流程已删除' }} · {{ formatDate(event.date) }}</span><h3>{{ event.name }}</h3></div></div><div class="event-card-meta"><span>经办人 {{ event.owner }}</span><span>{{ event.items.length }} 个文件项</span><span v-if="eventPending(event)" class="tag orange">待处理 {{ eventPending(event) }}</span><span v-else class="tag green">已完成</span></div><div class="progress-meta"><span>完成进度</span><strong>{{ eventProgress(event).percent }}%</strong></div><div class="progress-track"><i :style="{ width: `${eventProgress(event).percent}%` }"></i></div><div class="event-card-files"><span v-for="item in event.items.slice(0, 4)" :key="item.id" :class="{ done: !gaps(item).length }">{{ item.name }}</span><span v-if="event.items.length > 4">+{{ event.items.length - 4 }} 项</span></div></article></div></div></section>
        </template>
      </main>
    </section>

    <div v-if="modal" class="modal-backdrop" @click.self="requestCloseModal"><section ref="modalCard" class="modal-card" :class="{ 'modal-wide': modal === 'template' || modal === 'item' }" role="dialog" aria-modal="true" tabindex="-1" @keydown="handleModalKeydown">
      <template v-if="modal === 'project'"><div class="modal-heading"><div><span class="eyebrow">PROJECT</span><h2>{{ projectForm.id ? '编辑项目' : '新建项目' }}</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form class="form-grid" @submit.prevent="saveProject"><label>项目名称<input v-model="projectForm.name" required maxlength="100" placeholder="例如：华东智造产线升级项目"></label><label>客户名称<input v-model="projectForm.customer" required maxlength="100" placeholder="客户公司或单位"></label><label>负责人<input v-model="projectForm.owner" required maxlength="100" placeholder="项目负责人"></label><label>联系方式<input v-model="projectForm.contact" maxlength="4000" placeholder="电话、邮箱或其他联系方式"></label><label class="full-width">项目备注<textarea v-model="projectForm.note" rows="3" maxlength="4000" placeholder="项目背景或交付范围"></textarea></label><div class="full-width folder-picker"><div><span class="form-label">项目文件夹</span><p v-if="projectForm.id" class="form-help">目录不可用时重新定位。</p><p v-else class="form-help">选择上级文件夹，系统会创建同名目录。</p><span v-if="projectForm.directoryPath" class="selected-path" :title="projectForm.directoryPath">{{ projectForm.directoryPath }}</span></div><button v-if="!projectForm.id" type="button" class="button secondary" @click="chooseProjectFolder">选择文件夹</button></div><fieldset class="full-width"><legend>适用流程</legend><div class="template-checks"><label v-for="template in snapshot.templates" :key="template.id" class="template-check"><input v-model="projectForm.templateIds" type="checkbox" :value="template.id"><span class="template-icon tiny"><UiIcon name="workflow" /></span><span><strong>{{ template.name }}</strong><small>{{ template.rules.length }} 个文件项</small></span></label><span v-if="!snapshot.templates.length" class="form-help">请先新建流程。</span></div></fieldset><div class="modal-actions"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : '保存' }}</button></div></form></template>

      <template v-else-if="modal === 'event'"><div class="modal-heading"><div><span class="eyebrow">BUSINESS EVENT</span><h2>{{ eventForm.id ? '编辑业务事项' : '新建业务事项' }}</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form class="form-grid" @submit.prevent="saveEvent"><label class="full-width">事项名称<input v-model="eventForm.name" required maxlength="100" placeholder="例如：第一批控制柜发货"></label><label>流程<select v-model="eventForm.templateId" :disabled="Boolean(eventForm.id)" required><option value="" disabled>请选择流程</option><option v-for="template in activeProject?.templateIds.map(templateFor).filter(Boolean)" :key="template!.id" :value="template!.id">{{ template!.name }}</option></select></label><label>日期<input v-model="eventForm.date" required type="date"></label><label>经办人<input v-model="eventForm.owner" required maxlength="100"></label><div class="modal-actions full-width"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : eventForm.id ? '保存' : '创建' }}</button></div></form></template>

      <template v-else-if="modal === 'template'"><div class="modal-heading"><div><span class="eyebrow">WORKFLOW RULES</span><h2>{{ templateForm.id ? '编辑流程' : '新建流程' }}</h2></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form @submit.prevent="saveTemplate"><div class="form-grid"><label class="full-width">流程名称<input v-model="templateForm.name" required maxlength="100" placeholder="例如：发货流程"></label></div><RulesEditor v-model="templateForm.rules" :assets="templateFormAssets" /><div class="modal-actions"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : '保存' }}</button></div></form></template>

      <template v-else-if="modal === 'item'"><div class="modal-heading"><div><span class="eyebrow">CHECKLIST ITEM</span><h2>{{ itemForm.id ? '编辑清单项' : '添加文件项' }}</h2><p>不适用不计入完成率。</p></div><button class="modal-close" aria-label="关闭弹窗" @click="requestCloseModal"><UiIcon name="close" /></button></div><form class="form-grid" @submit.prevent="saveItem"><label class="full-width">文件名称<input v-model="itemForm.name" required maxlength="100" placeholder="例如：客户签收单"></label><label class="full-width">文件说明<textarea v-model="itemForm.note" rows="3" maxlength="4000" placeholder="用途或填写要求"></textarea></label><fieldset class="full-width"><legend>需要完成的步骤</legend><div class="step-checks"><label v-for="step in steps" :key="step"><input v-model="itemForm.required" type="checkbox" :value="step"><span>{{ stepLabels[step] }}</span></label></div></fieldset><div class="modal-actions"><button type="button" class="button secondary" @click="requestCloseModal">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : '保存' }}</button></div></form></template>
    </section></div>
    <div v-if="toast.visible" class="toast" :class="toast.tone" :role="toast.tone === 'error' ? 'alert' : 'status'"><span><UiIcon :name="toast.tone === 'success' ? 'check' : 'error'" /></span>{{ toast.message }}<button v-if="toast.tone === 'error'" class="toast-close" aria-label="关闭错误提示" @click="clearToast"><UiIcon name="close" /></button></div>
  </div>
</template>
