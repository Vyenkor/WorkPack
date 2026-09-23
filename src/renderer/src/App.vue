<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import ItemChecklist from './components/ItemChecklist.vue'
import RulesEditor from './components/RulesEditor.vue'
import {
  gaps,
  progress,
  stepLabels,
  steps,
  typeLabels,
  types,
  type BusinessEvent,
  type BusinessType,
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
const projectFilter = reactive({ keyword: '', type: 'all' as BusinessType | 'all', status: 'all' as 'all' | 'open' | 'done' })
const pendingFilter = reactive({ keyword: '', type: 'all' as BusinessType | 'all' })
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
const templateForm = reactive({ id: '', name: '', type: 'shipping' as BusinessType, rules: [] as Rule[] })
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
    const matchesKeyword = !keyword || [project.name, project.customer, project.owner].some(value => value.toLowerCase().includes(keyword))
    const matchesType = projectFilter.type === 'all' || project.events.some(event => event.type === projectFilter.type)
    const percent = projectProgress(project).percent
    const matchesStatus = projectFilter.status === 'all' || (projectFilter.status === 'done' ? percent === 100 && project.events.length > 0 : percent < 100 || !project.events.length)
    return matchesKeyword && matchesType && matchesStatus
  })
})
const filteredPending = computed(() => {
  const keyword = pendingFilter.keyword.trim().toLowerCase()
  return pendingRows.value.filter(row => {
    const matchesKeyword = !keyword || [row.project.name, row.project.customer, row.event.name, row.item.name].some(value => value.toLowerCase().includes(keyword))
    return matchesKeyword && (pendingFilter.type === 'all' || row.event.type === pendingFilter.type)
  })
})
const currentBreadcrumb = computed(() => {
  if (view.value !== 'project') return ({ home: '工作台', projects: '项目管理', pending: '待处理文件', templates: '文件模板' } as Record<Exclude<MainView, 'project'>, string>)[view.value]
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
function requestCloseModal() {
  if (modalDirty.value && !window.confirm('当前表单有未保存修改，确定关闭吗？')) return
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
function focusModal() { nextTick(() => focusableModalElements()[0]?.focus()) }
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
  toastTimer = setTimeout(() => { toast.value.visible = false }, 3200)
}
function formatDate(date: string) {
  const value = new Date(`${date}T00:00:00`)
  return Number.isNaN(value.getTime()) ? date : value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}
function formatFullDate(date: string) { return new Date(`${date}T00:00:00`).toLocaleDateString('zh-CN') }
function typeLabel(type: BusinessType) { return typeLabels[type] }
function templateFor(id: string) { return snapshot.value.templates.find(template => template.id === id) }
const templateFormAssets = computed(() => snapshot.value.templates.find(template => template.id === templateForm.id)?.assets ?? [])
function projectProgress(project: Project) { return progress(project.events.flatMap(event => event.items)) }
function eventProgress(event: BusinessEvent) { return progress(event.items) }
function eventPending(event: BusinessEvent) { return event.items.filter(item => gaps(item).length).length }
function projectActivity(project: Project) { return project.events.reduce((latest, event) => event.date > latest ? event.date : latest, '') }
function typeIcon(type: BusinessType) { return type === 'shipping' ? '↗' : type === 'receiving' ? '↙' : '◇' }
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
  view.value = next
  if (next !== 'project') { activeProjectId.value = null; activeEventId.value = null; activeEventOnly.value = false }
}
function openProject(project: Project, eventId?: string) {
  activeProjectId.value = project.id
  activeEventId.value = eventId ?? null
  activeEventOnly.value = Boolean(eventId)
  view.value = 'project'
}
function openEvent(project: Project, event: BusinessEvent) { openProject(project, event.id) }
function closeEventDetail() { activeEventId.value = null; activeEventOnly.value = false }
function runGlobalSearch() {
  const keyword = search.value.trim().toLowerCase()
  if (!keyword) { go('projects'); return }
  const project = snapshot.value.projects.find(item => [item.name, item.customer, item.owner].some(value => value.toLowerCase().includes(keyword)))
  if (project) { openProject(project); return }
  const row = itemRows.value.find(item => [item.event.name, item.item.name, ...item.item.attachments.map(attachment => attachment.name)].some(value => value.toLowerCase().includes(keyword)))
  if (row) { openEvent(row.project, row.event); return }
  showToast('没有找到匹配的项目或文件', 'error')
}

function resetProjectForm(project?: Project) {
  Object.assign(projectForm, project ? { id: project.id, name: project.name, customer: project.customer, contact: project.contact, owner: project.owner, note: project.note, templateIds: [...project.templateIds], directoryToken: '', directoryPath: project.folder } : { id: '', name: '', customer: '', contact: '', owner: '', note: '', templateIds: [], directoryToken: '', directoryPath: '' })
}
function openProjectModal(project?: Project) { resetProjectForm(project); modal.value = 'project'; markModalClean() }
async function chooseProjectFolder() {
  try {
    const result = await window.workpack.chooseDirectory()
    if (result) { projectForm.directoryToken = result.token; projectForm.directoryPath = result.path }
  } catch (error) { showToast(error instanceof Error ? error.message : '无法选择文件夹', 'error') }
}
async function saveProject() {
  if (!projectForm.name.trim() || !projectForm.customer.trim() || !projectForm.owner.trim()) { showToast('请填写项目名称、客户和负责人', 'error'); return }
  if (!projectForm.id && !projectForm.directoryToken) { showToast('请先选择项目上级文件夹', 'error'); return }
  const input = { id: projectForm.id || undefined, name: projectForm.name, customer: projectForm.customer, contact: projectForm.contact, owner: projectForm.owner, note: projectForm.note, templateIds: [...projectForm.templateIds], directoryToken: projectForm.directoryToken || undefined }
  const saved = await run(() => window.workpack.saveProject(input), projectForm.id ? '项目资料已更新' : '项目已创建')
  if (!saved) return
  const name = projectForm.name
  modal.value = null
  const project = snapshot.value.projects.find(item => item.name === name)
  if (project) openProject(project)
}

function resetEventForm(project: Project, event?: BusinessEvent) { Object.assign(eventForm, event ? { id: event.id, projectId: project.id, templateId: event.templateId, name: event.name, date: event.date, owner: event.owner } : { id: '', projectId: project.id, templateId: project.templateIds[0] ?? '', name: '', date: new Date().toISOString().slice(0, 10), owner: project.owner }) }
function openEventModal(project = activeProject.value, event?: BusinessEvent) { if (!project) return; resetEventForm(project, event); modal.value = 'event'; markModalClean() }
async function saveEvent() {
  if (!eventForm.name.trim() || !eventForm.templateId || !eventForm.owner.trim()) { showToast('请填写事项名称、模板和经办人', 'error'); return }
  const input = { id: eventForm.id, projectId: eventForm.projectId, templateId: eventForm.templateId, name: eventForm.name, date: eventForm.date, owner: eventForm.owner }
  const saved = eventForm.id
    ? await run(() => window.workpack.updateEvent(input), '业务事项已更新')
    : await run(() => window.workpack.createEvent(input), '业务事项已创建')
  if (!saved) return
  modal.value = null
  const project = snapshot.value.projects.find(item => item.id === eventForm.projectId)
  const eventId = typeof saved === 'string' ? saved : eventForm.id || undefined
  if (project) openProject(project, eventId)
}

function resetTemplateForm(template?: Template) {
  Object.assign(templateForm, template ? { id: template.id, name: template.name, type: template.type, rules: clone(template.rules) } : { id: '', name: '', type: 'shipping', rules: [] })
}
function openTemplateModal(template?: Template) { resetTemplateForm(template); modal.value = 'template'; markModalClean() }
async function saveTemplate() {
  if (!templateForm.name.trim() || !templateForm.rules.every(rule => rule.name.trim())) { showToast('请填写模板名称及每个文件项名称', 'error'); return }
  const saved = await run(() => window.workpack.saveTemplate({ id: templateForm.id || undefined, name: templateForm.name, type: templateForm.type, rules: clone(templateForm.rules) }), templateForm.id ? '模板规则已更新' : '模板已创建')
  if (saved) modal.value = null
}
async function deleteTemplate(template: Template) {
  if (!window.confirm(`确定删除“${template.name}”吗？`)) return
  await run(() => window.workpack.deleteTemplate(template.id), '模板已删除')
}
async function importTemplateAssets(template: Template) {
  const saved = await run(() => window.workpack.importTemplates(template.id), '模板文件已导入')
  if (saved !== false) {
    const latest = snapshot.value.templates.find(candidate => candidate.id === template.id)
    if (latest) openTemplateModal(latest)
  }
}
async function removeTemplateAsset(assetId: string) {
  if (!window.confirm('只移除这条模板文件记录吗？原文件不会被删除。')) return
  await run(() => window.workpack.removeTemplateAsset(assetId), '模板文件记录已移除')
}
async function exportTemplate(template: Template) {
  await run(() => window.workpack.exportTemplates(template.assets.map(asset => asset.id)), '模板文件已导出')
}

function resetItemForm(event: BusinessEvent, item?: Item) { Object.assign(itemForm, item ? { id: item.id, eventId: event.id, name: item.name, note: item.note, required: [...item.required] } : { id: '', eventId: event.id, name: '', note: '', required: [...steps] }) }
function openItemModal(event: BusinessEvent, item?: Item) { resetItemForm(event, item); modal.value = 'item'; markModalClean() }
async function saveItem() {
  if (!itemForm.name.trim() || !itemForm.required.length) { showToast('请填写文件名称，并至少选择一个完成步骤', 'error'); return }
  const saved = await run(() => window.workpack.saveItem({ id: itemForm.id || undefined, eventId: itemForm.eventId, name: itemForm.name, note: itemForm.note, required: [...itemForm.required] }), itemForm.id ? '清单项已更新' : '清单项已添加')
  if (saved) modal.value = null
}
async function removeItem(item: Item) {
  if (!window.confirm(`确定删除“${item.name}”吗？附件记录也会被移除。`)) return
  await run(() => window.workpack.deleteItem(item.id), '清单项已删除')
}
async function removeEvent(event: BusinessEvent) {
  if (!window.confirm(`确定删除“${event.name}”吗？清单和记录会被删除，项目文件夹中的工作副本不会被删除。`)) return
  const removed = await run(() => window.workpack.deleteEvent(event.id), '业务事项已删除')
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
async function importAttachments(id: string) { await run(() => window.workpack.importAttachments(id), '附件已添加') }
async function openAttachment(id: string) { await run(() => window.workpack.openAttachment(id)) }
async function relocateAttachment(id: string) { await run(() => window.workpack.relocateAttachment(id), '附件已重新关联') }
async function removeAttachment(id: string) { if (window.confirm('确定移除这条附件记录吗？原文件不会被删除。')) await run(() => window.workpack.removeAttachment(id), '附件记录已移除') }
async function openProjectFolder(project: Project) { await run(() => window.workpack.openProject(project.id)) }
async function relocateProject(project: Project) { const moved = await run(() => window.workpack.relocateProject(project.id), '项目目录已重新定位'); if (moved) await refresh() }

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
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark"><span></span><span></span><span></span></div><div><strong>WorkPack</strong><small>项目资料管理</small></div></div>
      <div class="workspace-switch"><span class="workspace-avatar">W</span><span>我的工作空间<small>本机数据</small></span><b>⌄</b></div>
      <p class="nav-caption">工作空间</p>
      <nav class="nav" aria-label="主导航">
        <button type="button" :class="{ active: view === 'home' }" @click="go('home')"><span class="nav-icon">▦</span>工作台</button>
        <button type="button" :class="{ active: view === 'projects' }" @click="go('projects')"><span class="nav-icon">▤</span>项目管理</button>
        <button type="button" :class="{ active: view === 'pending' }" @click="go('pending')"><span class="nav-icon">◷</span>待处理文件 <span v-if="navPending" class="nav-count">{{ navPending }}</span></button>
        <button type="button" :class="{ active: view === 'templates' }" @click="go('templates')"><span class="nav-icon">▧</span>文件模板</button>
      </nav>
      <div class="sidebar-bottom"><div class="flow-card"><span class="flow-caption">清晰的工作流程</span><strong>项目 → 事项 → 文件</strong><p>把每次业务需要的文件整理清楚，逐项跟踪完成情况。</p></div><div class="sidebar-user"><span class="user-avatar">陈</span><span><strong>本机用户</strong><small>项目负责人</small></span><span class="user-more">···</span></div></div>
    </aside>

    <section class="content-shell">
      <header class="topbar"><div class="breadcrumb"><span v-if="view === 'project'" class="breadcrumb-link" @click="go('projects')">项目管理</span><span v-if="view === 'project'" class="breadcrumb-divider">/</span>{{ currentBreadcrumb }}</div><div class="topbar-actions"><label class="global-search"><span>⌕</span><input v-model="search" type="search" placeholder="搜索项目或客户，按回车查询" aria-label="搜索项目或客户" @keyup.enter="runGlobalSearch"><kbd>↵</kbd></label><span class="today-label">{{ todayLabel() }}</span><span class="top-avatar">陈</span></div></header>

      <main class="view">
        <div v-if="loading" class="loading-state"><span class="spinner"></span><p>正在读取本机资料…</p></div>
        <div v-else-if="errorMessage" class="error-state"><div class="empty-icon">!</div><h2>资料读取失败</h2><p>{{ errorMessage }}</p><button class="button primary" @click="refresh">重新读取</button></div>

        <template v-else>
          <section v-if="view === 'home'" class="page-section">
            <div class="page-heading"><div><span class="eyebrow">WORKSPACE OVERVIEW</span><h1>工作台</h1><p>跟踪项目资料的准备、填写、签字和归档进度。</p></div><div class="heading-actions"><button class="button secondary" @click="go('templates')">管理模板</button><button class="button primary" @click="openProjectModal()">＋ 新建项目</button></div></div>
            <div class="stat-grid"><article class="stat-card"><span class="stat-icon violet">▤</span><div><span>项目总数</span><strong>{{ snapshot.projects.length }}</strong><small>本机项目资料</small></div></article><article class="stat-card"><span class="stat-icon orange">◷</span><div><span>待处理文件</span><strong>{{ navPending }}</strong><small>需要继续跟进</small></div></article><article class="stat-card"><span class="stat-icon blue">◇</span><div><span>未完成事项</span><strong>{{ openEvents.length }}</strong><small>业务事项总数 {{ allEvents.length }}</small></div></article><article class="stat-card"><span class="stat-icon green">▧</span><div><span>文件模板</span><strong>{{ snapshot.templates.length }}</strong><small>发货、收货及培训</small></div></article></div>
            <div class="home-grid"><section class="panel attention-panel"><div class="panel-heading"><div><h2>需要关注</h2><p>优先处理最近仍有缺口的文件。</p></div><button class="link" @click="go('pending')">查看全部 →</button></div><div v-if="!pendingRows.length" class="empty compact"><div class="empty-icon">✓</div><strong>{{ allEvents.length ? '目前没有待处理文件' : '还没有业务事项' }}</strong><p>{{ allEvents.length ? '所有已创建事项都已完成。' : '创建业务事项后，这里会显示需要跟进的文件。' }}</p></div><button v-for="row in pendingRows.slice(0, 5)" :key="row.item.id" class="attention-row" @click="openEvent(row.project, row.event)"><span class="attention-dot"></span><span class="attention-main"><strong>{{ row.item.name }}</strong><small>{{ row.project.name }} · {{ row.event.name }}</small></span><span class="attention-tags"><span v-for="gap in row.gaps.slice(0, 2)" :key="gap" class="tag orange">{{ gap }}</span></span><span class="row-arrow">→</span></button></section><section class="panel recent-panel"><div class="panel-heading"><div><h2>最近项目</h2><p>按最近事项日期排序。</p></div><button class="link" @click="go('projects')">全部项目 →</button></div><div v-if="!snapshot.projects.length" class="empty compact"><div class="empty-icon">＋</div><p>创建第一个项目开始整理资料。</p></div><button v-for="project in recentProjects" :key="project.id" class="project-mini" @click="openProject(project)"><span class="project-mini-mark">{{ project.name.slice(0, 1) }}</span><span><strong>{{ project.name }}</strong><small>{{ project.customer }}</small></span><span class="mini-progress"><i :style="{ width: `${projectProgress(project).percent}%` }"></i></span><b>{{ projectProgress(project).percent }}%</b></button></section></div>
          </section>

          <section v-else-if="view === 'projects'" class="page-section"><div class="page-heading"><div><span class="eyebrow">PROJECTS</span><h1>项目管理</h1><p>按项目查看业务事项及所有关联资料。</p></div><button class="button primary" @click="openProjectModal()">＋ 新建项目</button></div><div class="filter-bar"><label class="filter-search"><span>⌕</span><input v-model="projectFilter.keyword" placeholder="搜索项目、客户或负责人"></label><select v-model="projectFilter.type"><option value="all">全部事项类型</option><option v-for="type in types" :key="type" :value="type">{{ typeLabel(type) }}</option></select><select v-model="projectFilter.status"><option value="all">全部完成状态</option><option value="open">进行中</option><option value="done">已完成</option></select><span class="filter-result">共 {{ filteredProjects.length }} 个项目</span></div><div class="project-list"><article v-for="project in filteredProjects" :key="project.id" class="project-card"><div class="project-card-main"><span class="project-mark">{{ project.name.slice(0, 1) }}</span><div class="project-title"><button class="title-button" @click="openProject(project)">{{ project.name }}</button><span class="project-code">{{ project.customer }}</span><p v-if="project.note">{{ project.note }}</p></div><div class="project-owner"><small>负责人</small><strong>{{ project.owner }}</strong></div><div class="project-progress"><div class="progress-meta"><span>资料进度</span><strong>{{ projectProgress(project).percent }}%</strong></div><div class="progress-track"><i :style="{ width: `${projectProgress(project).percent}%` }"></i></div><small>{{ projectProgress(project).done }} / {{ projectProgress(project).total || 0 }} 个必要步骤</small></div><button class="row-chevron" aria-label="查看项目" @click="openProject(project)">→</button></div><div class="project-card-footer"><span>事项 {{ project.events.length }} 个</span><span>待处理 {{ project.events.reduce((sum, event) => sum + eventPending(event), 0) }} 项</span><span class="folder-status" :class="project.folderExists ? 'ok' : 'warning'">{{ project.folderExists ? '● 项目目录正常' : '⚠ 项目目录需要重新定位' }}</span><button class="link" @click="openProjectFolder(project)">打开文件夹</button></div></article><div v-if="!filteredProjects.length" class="empty"><div class="empty-icon">⌕</div><h3>没有匹配的项目</h3><p>调整筛选条件，或创建一个新项目。</p></div></div></section>

          <section v-else-if="view === 'pending'" class="page-section"><div class="page-heading"><div><span class="eyebrow">FOLLOW UP</span><h1>待处理文件</h1><p>集中查看尚未准备、填写、签字或归档的文件。</p></div><div class="summary-pill"><strong>{{ filteredPending.length }}</strong><span>项待处理</span></div></div><div class="filter-bar"><label class="filter-search"><span>⌕</span><input v-model="pendingFilter.keyword" placeholder="搜索项目、事项或文件"></label><select v-model="pendingFilter.type"><option value="all">全部事项类型</option><option v-for="type in types" :key="type" :value="type">{{ typeLabel(type) }}</option></select><span class="filter-result">按项目归类显示</span></div><div class="pending-table panel"><div v-if="!filteredPending.length" class="empty"><div class="empty-icon">✓</div><h3>没有待处理文件</h3><p>当前筛选范围内的清单都已完成。</p></div><div v-else class="pending-table-head"><span>文件</span><span>项目及事项</span><span>缺口</span><span>负责人</span><span></span></div><button v-for="row in filteredPending" :key="row.item.id" class="pending-row" @click="openEvent(row.project, row.event)"><span class="pending-file"><span class="file-icon">□</span><strong>{{ row.item.name }}</strong></span><span><strong>{{ row.project.name }}</strong><small>{{ typeLabel(row.event.type) }} · {{ row.event.name }}</small></span><span class="pending-gaps"><span v-for="gap in row.gaps" :key="gap" class="tag orange">{{ gap }}</span></span><span>{{ row.event.owner }}</span><span class="row-arrow">→</span></button></div></section>

          <section v-else-if="view === 'templates'" class="page-section"><div class="page-heading"><div><span class="eyebrow">TEMPLATE LIBRARY</span><h1>文件模板</h1><p>维护可复用的文件清单规则和空白模板文件。</p></div><button class="button primary" @click="openTemplateModal()">＋ 新建模板</button></div><div class="notice-banner"><span class="notice-icon">i</span><span>模板文件会保存在 WorkPack 的本机数据目录中。新建业务事项时会复制当前模板规则，之后修改模板不会影响已有事项。</span></div><div class="template-grid"><article v-for="template in snapshot.templates" :key="template.id" class="template-card"><div class="template-card-head"><span class="template-icon" :class="template.type">{{ typeIcon(template.type) }}</span><div><span class="type-label">{{ typeLabel(template.type) }}</span><h2>{{ template.name }}</h2></div><button class="more-button" @click="openTemplateModal(template)">···</button></div><p class="template-description">用于{{ typeLabel(template.type) }}环节的资料归集和完成跟踪。</p><div class="template-stats"><span><strong>{{ template.rules.length }}</strong> 个文件项</span><span><strong>{{ template.assets.length }}</strong> 个模板文件</span></div><div class="rule-preview"><span v-for="rule in template.rules.slice(0, 3)" :key="rule.id">{{ rule.name }}<small>{{ rule.required.length }} 个步骤</small></span><span v-if="template.rules.length > 3" class="more-rules">+{{ template.rules.length - 3 }} 项</span></div><div class="asset-area"><div class="asset-heading"><strong>模板文件</strong><span>{{ template.assets.filter(asset => asset.exists).length }}/{{ template.assets.length }} 可用</span></div><div v-if="!template.assets.length" class="asset-empty">尚未导入模板文件</div><div v-for="asset in template.assets" :key="asset.id" class="asset-row"><span class="file-icon">□</span><span class="asset-name" :title="asset.path">{{ asset.name }}</span><span :class="asset.exists ? 'asset-ok' : 'asset-missing'">{{ asset.exists ? '可用' : '失效' }}</span><button class="asset-remove" title="移除记录" @click="removeTemplateAsset(asset.id)">×</button></div></div><div class="template-actions"><button class="button secondary small" @click="openTemplateModal(template)">编辑规则</button><button class="button secondary small" @click="importTemplateAssets(template)">导入文件</button><button class="button secondary small" :disabled="!template.assets.length" @click="exportTemplate(template)">导出</button><button class="button danger-link small" @click="deleteTemplate(template)">删除</button></div></article><div v-if="!snapshot.templates.length" class="empty"><div class="empty-icon">▧</div><h3>还没有文件模板</h3><p>新建模板后即可用于业务事项。</p></div></div></section>

          <section v-else-if="view === 'project' && activeProject" class="page-section project-detail"><div class="detail-heading"><button class="back-button" @click="go('projects')">← 项目管理</button><div class="detail-title-row"><div><span class="eyebrow">PROJECT DETAIL</span><h1>{{ activeProject.name }}</h1><p>{{ activeProject.customer }}<span class="dot-separator">·</span>{{ activeProject.owner }} 负责</p></div><div class="heading-actions"><button class="button secondary" @click="openProjectFolder(activeProject)">打开项目文件夹</button><button class="button secondary" @click="openProjectModal(activeProject)">编辑项目</button><button class="button primary" @click="openEventModal(activeProject)">＋ 新建事项</button></div></div></div><div v-if="!activeProject.folderExists" class="warning-banner"><span>⚠</span><span>项目目录已失效或被移动。请重新定位原项目文件夹，恢复附件和模板文件访问。</span><button class="button warning small" @click="relocateProject(activeProject)">重新定位</button></div><div class="project-overview-grid"><article><span>项目负责人</span><strong>{{ activeProject.owner }}</strong><small>{{ activeProject.contact || '未填写联系方式' }}</small></article><article><span>整体资料进度</span><strong>{{ projectProgress(activeProject).percent }}%</strong><small>{{ projectProgress(activeProject).done }} / {{ projectProgress(activeProject).total }} 个必要步骤</small></article><article><span>业务事项</span><strong>{{ activeProject.events.length }}</strong><small>待处理 {{ activeProject.events.reduce((sum, event) => sum + eventPending(event), 0) }} 项</small></article><article><span>项目文件夹</span><strong class="folder-value" :title="activeProject.folder">{{ activeProject.folder }}</strong><small :class="activeProject.folderExists ? 'text-success' : 'text-warning'">{{ activeProject.folderExists ? '目录可访问' : '目录不可用' }}</small></article></div><div v-if="activeEvent && activeEventOnly" class="event-detail panel"><div class="event-detail-heading"><div><div class="event-actions"><button class="back-button small-back" @click="closeEventDetail">← 返回事项列表</button><button class="button secondary small" @click="openEventModal(activeProject, activeEvent)">编辑事项</button><button class="button danger-link small" @click="removeEvent(activeEvent)">删除事项</button></div><div class="event-title"><span class="event-type-icon" :class="activeEvent.type">{{ typeIcon(activeEvent.type) }}</span><div><span class="type-label">{{ typeLabel(activeEvent.type) }} · {{ formatFullDate(activeEvent.date) }}</span><h2>{{ activeEvent.name }}</h2><p>经办人：{{ activeEvent.owner }}<span class="dot-separator">·</span>使用模板：{{ templateFor(activeEvent.templateId)?.name || '已删除模板' }}</p></div></div></div><div class="event-progress-large"><strong>{{ eventProgress(activeEvent).percent }}%</strong><span>完成度</span><div class="progress-track"><i :style="{ width: `${eventProgress(activeEvent).percent}%` }"></i></div></div></div><div class="checklist-heading"><div><h3>文件清单</h3><p>完成率同时要求必要步骤完成，且准备步骤有可用文件。</p></div><div class="heading-actions"><span v-if="savedEventId === activeEvent.id" class="inline-saved">已保存可用步骤</span><button class="button secondary small" :disabled="busy || !activeEvent.items.length" @click="completeEvent(activeEvent)">一键完成可用步骤</button><button class="button secondary small" @click="openItemModal(activeEvent)">＋ 添加文件项</button></div></div><ItemChecklist :items="activeEvent.items" :busy="busy" :saved-item-id="savedItemId" @status="setItemStatus" @complete="completeItem" @edit="item => openItemModal(activeEvent!, item)" @remove="removeItem" @upload="importAttachments" @open="openAttachment" @relocate="relocateAttachment" @detach="removeAttachment" /></div><div v-else class="event-list-section"><div class="section-heading"><div><h2>业务事项</h2><p>每次发货、收货或培训都是一份独立的文件清单。</p></div><span class="section-count">{{ activeProject.events.length }} 个事项</span></div><div v-if="!activeProject.events.length" class="empty panel"><div class="empty-icon">◇</div><h3>还没有业务事项</h3><p>创建一次发货、收货或培训事项，开始生成文件清单。</p><button class="button primary" @click="openEventModal(activeProject)">＋ 新建事项</button></div><div v-else class="event-cards"><article v-for="event in activeProject.events" :key="event.id" class="event-card" @click="openEvent(activeProject, event)"><div class="event-card-head"><span class="event-type-icon" :class="event.type">{{ typeIcon(event.type) }}</span><div><span class="type-label">{{ typeLabel(event.type) }} · {{ formatDate(event.date) }}</span><h3>{{ event.name }}</h3></div><span class="row-arrow">→</span></div><div class="event-card-meta"><span>经办人 {{ event.owner }}</span><span>{{ event.items.length }} 个文件项</span><span v-if="eventPending(event)" class="tag orange">待处理 {{ eventPending(event) }}</span><span v-else class="tag green">已完成</span></div><div class="progress-meta"><span>完成进度</span><strong>{{ eventProgress(event).percent }}%</strong></div><div class="progress-track"><i :style="{ width: `${eventProgress(event).percent}%` }"></i></div><div class="event-card-files"><span v-for="item in event.items.slice(0, 4)" :key="item.id" :class="{ done: !gaps(item).length }">{{ item.name }}</span><span v-if="event.items.length > 4">+{{ event.items.length - 4 }} 项</span></div></article></div></div></section>
        </template>
      </main>
    </section>

    <div v-if="modal" class="modal-backdrop" @click.self="requestCloseModal"><section ref="modalCard" class="modal-card" :class="{ 'modal-wide': modal === 'template' || modal === 'item' }" role="dialog" aria-modal="true" tabindex="-1" @keydown="handleModalKeydown">
      <template v-if="modal === 'project'"><div class="modal-heading"><div><span class="eyebrow">PROJECT</span><h2>{{ projectForm.id ? '编辑项目' : '新建项目' }}</h2><p>先建立项目，再在其中记录每次业务事项。</p></div><button class="modal-close" @click="modal = null">×</button></div><form class="form-grid" @submit.prevent="saveProject"><label>项目名称<input v-model="projectForm.name" required maxlength="100" placeholder="例如：华东智造产线升级项目"></label><label>客户名称<input v-model="projectForm.customer" required maxlength="100" placeholder="客户公司或单位"></label><label>负责人<input v-model="projectForm.owner" required maxlength="100" placeholder="项目负责人"></label><label>联系方式<input v-model="projectForm.contact" maxlength="4000" placeholder="电话、邮箱或其他联系方式"></label><label class="full-width">项目备注<textarea v-model="projectForm.note" rows="3" maxlength="4000" placeholder="记录项目背景、交付范围等信息"></textarea></label><div class="full-width folder-picker"><div><span class="form-label">项目文件夹</span><p v-if="projectForm.id" class="form-help">编辑项目时，项目文件夹保持不变。若目录失效，请在项目详情中重新定位。</p><p v-else class="form-help">选择上级文件夹，WorkPack 会自动创建同名项目文件夹。</p><span v-if="projectForm.directoryPath" class="selected-path">{{ projectForm.directoryPath }}</span></div><button v-if="!projectForm.id" type="button" class="button secondary" @click="chooseProjectFolder">选择上级文件夹</button></div><fieldset class="full-width"><legend>默认适用模板</legend><p class="form-help">创建事项时只能选择已加入项目的模板，后续可在编辑项目时调整。</p><div class="template-checks"><label v-for="template in snapshot.templates" :key="template.id" class="template-check"><input v-model="projectForm.templateIds" type="checkbox" :value="template.id"><span class="template-icon tiny" :class="template.type">{{ typeIcon(template.type) }}</span><span><strong>{{ template.name }}</strong><small>{{ typeLabel(template.type) }} · {{ template.rules.length }} 个文件项</small></span></label><span v-if="!snapshot.templates.length" class="form-help">请先创建文件模板。</span></div></fieldset><div class="modal-actions"><button type="button" class="button secondary" @click="modal = null">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : '保存项目' }}</button></div></form></template>

      <template v-else-if="modal === 'event'"><div class="modal-heading"><div><span class="eyebrow">BUSINESS EVENT</span><h2>{{ eventForm.id ? '编辑业务事项' : '新建业务事项' }}</h2><p>{{ eventForm.id ? '可修改事项名称、日期和经办人。模板及清单保持不变。' : '系统会根据所选模板生成本次事项的独立清单。' }}</p></div><button class="modal-close" @click="modal = null">×</button></div><form class="form-grid" @submit.prevent="saveEvent"><label class="full-width">事项名称<input v-model="eventForm.name" required maxlength="100" placeholder="例如：第一批控制柜发货"></label><label>事项类型及模板<select v-model="eventForm.templateId" :disabled="Boolean(eventForm.id)" required><option value="" disabled>请选择项目模板</option><option v-for="template in activeProject?.templateIds.map(templateFor).filter(Boolean)" :key="template!.id" :value="template!.id">{{ typeLabel(template!.type) }} · {{ template!.name }}</option></select></label><label>业务日期<input v-model="eventForm.date" required type="date"></label><label>经办人<input v-model="eventForm.owner" required maxlength="100"></label><div class="modal-actions full-width"><button type="button" class="button secondary" @click="modal = null">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : eventForm.id ? '保存事项' : '创建事项' }}</button></div></form></template>

      <template v-else-if="modal === 'template'"><div class="modal-heading"><div><span class="eyebrow">TEMPLATE RULES</span><h2>{{ templateForm.id ? '编辑模板' : '新建模板' }}</h2><p>清单规则会在创建事项时复制为快照。</p></div><button class="modal-close" @click="modal = null">×</button></div><form @submit.prevent="saveTemplate"><div class="form-grid"><label>模板名称<input v-model="templateForm.name" required maxlength="100" placeholder="例如：发货资料模板"></label><label>事项类型<select v-model="templateForm.type" :disabled="Boolean(templateForm.id)"><option v-for="type in types" :key="type" :value="type">{{ typeLabel(type) }}</option></select></label></div><RulesEditor v-model="templateForm.rules" :assets="templateFormAssets" /><div class="modal-actions"><button type="button" class="button secondary" @click="modal = null">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : '保存模板' }}</button></div></form></template>

      <template v-else-if="modal === 'item'"><div class="modal-heading"><div><span class="eyebrow">CHECKLIST ITEM</span><h2>{{ itemForm.id ? '编辑清单项' : '添加文件项' }}</h2><p>不适用的步骤不会计入事项完成率。</p></div><button class="modal-close" @click="modal = null">×</button></div><form class="form-grid" @submit.prevent="saveItem"><label class="full-width">文件名称<input v-model="itemForm.name" required maxlength="100" placeholder="例如：客户签收单"></label><label class="full-width">文件说明<textarea v-model="itemForm.note" rows="3" maxlength="4000" placeholder="说明这份文件的用途或填写要求"></textarea></label><fieldset class="full-width"><legend>需要完成的步骤</legend><div class="step-checks"><label v-for="step in steps" :key="step"><input v-model="itemForm.required" type="checkbox" :value="step"><span>{{ stepLabels[step] }}</span></label></div></fieldset><div class="modal-actions"><button type="button" class="button secondary" @click="modal = null">取消</button><button type="submit" class="button primary" :disabled="busy">{{ busy ? '保存中…' : '保存清单项' }}</button></div></form></template>
    </section></div>
    <div v-if="toast.visible" class="toast" :class="toast.tone"><span>{{ toast.tone === 'success' ? '✓' : '!' }}</span>{{ toast.message }}</div>
  </div>
</template>
