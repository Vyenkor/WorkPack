import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { normalizePendingViewState, parsePendingViewState, PENDING_VIEW_PREFERENCE_KEY, serializePendingViewState, steps, type PendingViewState, type Snapshot, type Project, type Template, type Item, type Asset, type BusinessEvent } from '../shared/model'

const name = z.string().trim().min(1, '名称不能为空').max(100)
const text = z.string().max(4000)
const id = z.string().uuid()
const required = z.array(z.enum(steps)).max(4).refine(a => new Set(a).size === a.length)
const rule = z.object({ id, name, note: text, required, assetId: id.optional() })
const projectSchema = z.object({ id: id.optional(), name, customer: name, contact: text, owner: name, note: text, templateIds: z.array(id).max(100) })
const templateSchema = z.object({ id: id.optional(), name, rules: z.array(rule).max(200).refine(a => new Set(a.map(r => r.id)).size === a.length) })
const eventSchema = z.object({ projectId: id, templateId: id, name, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s }, '日期无效'), owner: name })
const eventUpdateSchema = eventSchema.extend({ id })
const itemSchema = z.object({ id: id.optional(), eventId: id, name, note: text, required })
const statusSchema = z.object({ id, step: z.enum(steps), status: z.enum(['pending', 'done', 'na']) })
type Row = Record<string, any>

export function safeName(value: string): string {
  const result = name.parse(value)
  if (/[<>:"/\\|?*\x00-\x1f]/.test(result) || /[. ]$/.test(result) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result) || result === '.' || result === '..') throw new Error('名称不能包含 Windows 保留名称、特殊字符或末尾句点')
  return result
}
function directory(value: string) {
  if (!path.isAbsolute(value) || !fs.statSync(value).isDirectory()) throw new Error('目录不存在，请重新选择')
  return fs.realpathSync(value)
}
function inside(root: string, relative: string): string {
  const target = path.resolve(root, relative)
  const rel = path.relative(root, target)
  if (path.isAbsolute(relative) || !rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('文件路径超出项目目录')
  let check = target
  while (check !== root) {
    if (fs.existsSync(check) && fs.lstatSync(check).isSymbolicLink()) throw new Error('项目内包含符号链接，请使用普通文件夹')
    check = path.dirname(check)
  }
  return target
}
function present(file: string) { try { return fs.statSync(file).isFile() } catch { return false } }
function folderPresent(file: string) { try { return fs.statSync(file).isDirectory() } catch { return false } }
function stateMap(requiredSteps: string[]) { return Object.fromEntries(steps.map(s => [s, requiredSteps.includes(s) ? 'pending' : 'na'])) }
function compactFileName(value: string) { return path.parse(value).name.toLowerCase().replace(/模板|空白|文件|表格|资料/g, '').replace(/[\s._\-（）()]/g, '') }
function assetMatchesRule(assetName: string, ruleName: string) {
  const asset = compactFileName(assetName), rule = compactFileName(ruleName)
  return Boolean(asset && rule && (asset === rule || asset.includes(rule) || rule.includes(asset)))
}
const legacyWorkflowFolders: Record<string, string> = { shipping: '发货', receiving: '收货', training: '培训' }
const customTypePrefix = 'custom:'
function workflowFolder(value: string) {
  if (value.startsWith(customTypePrefix)) return value.slice(customTypePrefix.length)
  return legacyWorkflowFolders[value] ?? value
}
// templates.name is the display name. Built-in templates.type stays shipping/receiving/training.
// A custom templates.type is custom: plus the current safe name, so it cannot collide with those keys.
// Older custom rows may still store a bare folder name; workflowFolder leaves those unchanged.
// events.type is the templates.type captured at createEvent and is never rewritten.

/** All disk access is in the main process. Rollbacks only remove paths created by this operation. */
export class WorkPackService {
  db: Database.Database
  templateRoot: string
  projectRoot?: string
  constructor(readonly dataDirectory: string, readonly copyFile = fs.copyFileSync, readonly libraryMode = false, locations: { templateRoot?: string; projectRoot?: string } = {}) {
    fs.mkdirSync(dataDirectory, { recursive: true })
    this.templateRoot = locations.templateRoot ?? path.join(dataDirectory, 'templates')
    this.projectRoot = locations.projectRoot
    fs.mkdirSync(this.templateRoot, { recursive: true })
    this.db = new Database(path.join(dataDirectory, libraryMode ? 'workpack-v3.sqlite' : 'workpack.sqlite'))
    this.db.pragma('foreign_keys = ON')
    // WAL keeps recent commits in workpack.sqlite-wal. Copying only the main file while this connection is open can miss them.
    this.db.pragma('journal_mode = WAL')
    const version = this.db.pragma('user_version', { simple: true }) as number
    if (version > 2) { this.db.close(); throw new Error('数据来自更新版本，请使用新版 WorkPack 打开') }
    if (version < 1) this.db.transaction(() => {
      this.db.exec(`
        CREATE TABLE templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, rules TEXT NOT NULL);
        CREATE TABLE assets (id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE, name TEXT NOT NULL, path TEXT NOT NULL);
        CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, customer TEXT NOT NULL, contact TEXT NOT NULL, owner TEXT NOT NULL, note TEXT NOT NULL, folder TEXT NOT NULL UNIQUE, template_ids TEXT NOT NULL);
        CREATE TABLE events (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), template_id TEXT NOT NULL, type TEXT NOT NULL, name TEXT NOT NULL, date TEXT NOT NULL, owner TEXT NOT NULL);
        CREATE TABLE items (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), name TEXT NOT NULL, note TEXT NOT NULL, required TEXT NOT NULL, states TEXT NOT NULL);
        CREATE TABLE attachments (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE, name TEXT NOT NULL, path TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE project_copies (project_id TEXT NOT NULL REFERENCES projects(id), asset_id TEXT NOT NULL, PRIMARY KEY(project_id, asset_id));
        CREATE INDEX events_project ON events(project_id);
        CREATE INDEX items_event ON items(event_id);
        CREATE INDEX attachments_item ON attachments(item_id);
        PRAGMA user_version = 1;
      `)
      const seeds: Record<string, [string, string[]][]> = {
        shipping: [['发货清单', [...steps]], ['客户签收单', [...steps]], ['物流凭证', ['prepared', 'archived']], ['设备照片', ['prepared', 'archived']]],
        receiving: [['收货登记表', [...steps]], ['到货验收单', [...steps]], ['异常情况记录', ['prepared', 'filled', 'archived']]],
        training: [['培训计划', ['prepared', 'filled', 'archived']], ['培训签到表', [...steps]], ['培训记录', [...steps]], ['现场照片', ['prepared', 'archived']]]
      }
      if (!libraryMode) for (const type of Object.keys(seeds)) this.db.prepare('INSERT INTO templates VALUES (?, ?, ?, ?)').run(randomUUID(), `${legacyWorkflowFolders[type]}资料模板`, type, JSON.stringify(seeds[type].map(([name, required]) => ({ id: randomUUID(), name, note: '', required }))))
    })()
    if ((this.db.pragma('user_version', { simple: true }) as number) < 2) this.db.transaction(() => {
      this.db.exec(`CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version = 2;`)
    })()
    if (libraryMode) {
      this.db.exec(`CREATE TABLE IF NOT EXISTS library_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
        CREATE TABLE IF NOT EXISTS library_meta (template_id TEXT PRIMARY KEY REFERENCES templates(id) ON DELETE CASCADE, category_id TEXT REFERENCES library_categories(id) ON DELETE SET NULL, purpose TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS event_templates (event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, template_id TEXT NOT NULL, PRIMARY KEY(event_id, template_id));
        CREATE TABLE IF NOT EXISTS document_tasks (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE, name TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL);`)
    }
  }
  close() { this.db.close() }
  private get(table: string, value: string): Row {
    id.parse(value)
    const result = this.db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(value) as Row | undefined
    if (!result) throw new Error('记录不存在，请刷新后重试')
    return result
  }
  private all(table: string): Row[] { return this.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all() as Row[] }
  private projectForItem(value: string) {
    const item = this.get('items', value)
    const event = this.get('events', item.event_id)
    return { item, event, project: this.get('projects', event.project_id) }
  }
  private root(project: Row): string {
    if (!folderPresent(project.folder)) throw new Error('项目文件夹已失效，请先重新定位项目目录')
    const root = directory(project.folder)
    const marker = inside(root, '.workpack-project.json')
    if (!present(marker) || JSON.parse(fs.readFileSync(marker, 'utf8')).id !== project.id) throw new Error('目录与项目不匹配，请重新定位原项目文件夹')
    return root
  }
  private atomic<T>(action: (files: string[], dirs: string[]) => T): T {
    const files: string[] = [], dirs: string[] = []
    try { return this.db.transaction(() => action(files, dirs))() }
    catch (error) {
      const failures: string[] = []
      for (const file of files.reverse()) try { fs.unlinkSync(file) } catch { failures.push(file) }
      for (const dir of dirs.reverse()) try { fs.rmdirSync(dir) } catch { failures.push(dir) }
      if (failures.length) throw new Error(`${error instanceof Error ? error.message : error}；部分临时文件清理失败，请检查：${failures.join('、')}`)
      throw error
    }
  }
  private mkdir(root: string, relative: string, dirs: string[]) {
    let current = root
    for (const part of relative.split(path.sep)) {
      current = inside(root, path.relative(root, path.join(current, part)))
      if (!fs.existsSync(current)) { fs.mkdirSync(current); dirs.push(current) }
      else if (!fs.statSync(current).isDirectory()) throw new Error('目标路径被同名文件占用')
    }
    return current
  }
  private copy(source: string, targetDir: string, files: string[]): string {
    if (!present(source)) throw new Error(`来源文件不存在：${path.basename(source)}`)
    const original = safeName(path.basename(source)), parsed = path.parse(original)
    for (let n = 0; n < 10000; n++) {
      const target = path.join(targetDir, n ? `${parsed.name} (${n})${parsed.ext}` : original)
      if (fs.existsSync(target)) continue
      try { this.copyFile(source, target, fs.constants.COPYFILE_EXCL) }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue
        if (fs.existsSync(target)) files.push(target)
        throw error
      }
      files.push(target)
      return target
    }
    throw new Error('重名文件过多，请整理目标目录')
  }
  snapshot(): Snapshot {
    const assets = this.all('assets')
    const metadata = this.libraryMode ? this.all('library_meta') : []
    const templates = this.all('templates').map(t => ({ ...t, rules: JSON.parse(t.rules), purpose: metadata.find(m => m.template_id === t.id)?.purpose ?? '', categoryId: metadata.find(m => m.template_id === t.id)?.category_id ?? null, assets: assets.filter(a => a.template_id === t.id).map(a => {
      let exists = false
      try { exists = present(inside(this.templateRoot, a.path)) } catch { /* Keep unavailable assets visible. */ }
      return { id: a.id, name: a.name, path: a.path, exists }
    }) })) as Template[]
    const allEvents = this.all('events'), allItems = this.all('items'), attachments = this.all('attachments')
    const tasks = this.libraryMode ? this.all('document_tasks') : []
    const eventTemplates = this.libraryMode ? this.all('event_templates') : []
    const projects = this.all('projects').map(p => {
      let folderExists = false
      try { this.root(p); folderExists = true } catch { /* A replaced directory is not the original project. */ }
      return {
      id: p.id, name: p.name, customer: p.customer, contact: p.contact, owner: p.owner, note: p.note, folder: p.folder, templateIds: JSON.parse(p.template_ids), folderExists,
      events: allEvents.filter(e => e.project_id === p.id).map(e => ({
        id: e.id, projectId: p.id, templateId: e.template_id, templateIds: this.libraryMode ? eventTemplates.filter(link => link.event_id === e.id).map(link => link.template_id) : undefined, name: e.name, date: e.date, owner: e.owner,
        items: allItems.filter(i => i.event_id === e.id).map(i => ({
          id: i.id, eventId: e.id, name: i.name, note: i.note, required: JSON.parse(i.required), states: JSON.parse(i.states), tasks: this.libraryMode ? tasks.filter(task => task.item_id === i.id).sort((a,b) => a.position - b.position).map(task => ({ id: task.id, itemId: i.id, name: task.name, done: Boolean(task.done), position: task.position })) : undefined,
          attachments: attachments.filter(a => a.item_id === i.id).map(a => {
            let exists = false
            try { exists = folderExists && present(inside(p.folder, a.path)) } catch { /* Invalid paths are shown as missing. */ }
            return { id: a.id, itemId: i.id, name: a.name, path: a.path, createdAt: a.created_at, exists }
          })
        })) as Item[]
      })) as BusinessEvent[]
    }}) as Project[]
    for (const project of projects) for (const event of project.events) for (const item of event.items) {
      if (!item.attachments.some(a => a.exists) && item.states.prepared === 'done') item.states.prepared = 'pending'
      if (!item.attachments.some(a => a.exists)) for (const task of item.tasks ?? []) if (task.name === '准备文件') task.done = false
    }
    return { projects, templates: templates.map(template => ({ id: template.id, name: template.name, purpose: template.purpose, categoryId: template.categoryId, rules: template.rules, assets: template.assets })), categories: this.libraryMode ? this.all('library_categories') as {id:string;name:string}[] : undefined, dataDirectory: this.dataDirectory, pendingView: this.reconcilePendingView() }
  }
  savePendingView(input: unknown): PendingViewState {
    const normalized = normalizePendingViewState(parsePendingViewState(input), this.pendingFilterIds())
    this.writePreference(PENDING_VIEW_PREFERENCE_KEY, serializePendingViewState(normalized))
    return normalized
  }
  private preference(key: string) {
    const row = this.db.prepare('SELECT value FROM preferences WHERE key=?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }
  private writePreference(key: string, value: string) {
    this.db.prepare('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)').run(key, value)
  }
  /** Single-file snapshot of this open connection, including commits that are still only in the WAL. */
  backupDatabase(destination: string) {
    if (!destination.trim()) throw new Error('请指定备份文件')
    const target = path.resolve(destination)
    const live = path.resolve(this.db.name)
    if (target === live || target === `${live}-wal` || target === `${live}-shm`) throw new Error('不能覆盖正在使用的数据库文件')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const image = this.db.serialize()
    if (!image?.byteLength) throw new Error('无法生成数据库备份')
    const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`)
    fs.writeFileSync(temporary, image)
    try { fs.renameSync(temporary, target) }
    catch (error) {
      fs.rmSync(temporary, { force: true })
      throw error
    }
  }
  private pendingFilterIds() {
    return {
      projectIds: (this.db.prepare('SELECT id FROM projects').all() as Array<{ id: string }>).map(row => row.id),
      templateIds: (this.db.prepare('SELECT id FROM templates').all() as Array<{ id: string }>).map(row => row.id)
    }
  }
  private reconcilePendingView(): PendingViewState {
    const raw = this.preference(PENDING_VIEW_PREFERENCE_KEY)
    const normalized = normalizePendingViewState(parsePendingViewState(raw), this.pendingFilterIds())
    const serialized = serializePendingViewState(normalized)
    if (raw !== null && raw !== serialized) this.writePreference(PENDING_VIEW_PREFERENCE_KEY, serialized)
    return normalized
  }
  saveTemplate(input: unknown) {
    const data = templateSchema.parse(input)
    if (data.id) {
      const existing = this.get('templates', data.id)
      const type = existing.type in legacyWorkflowFolders ? existing.type : customTypePrefix + safeName(data.name)
      const saved = this.db.prepare('UPDATE templates SET name=?, type=?, rules=? WHERE id=?').run(data.name, type, JSON.stringify(data.rules), data.id)
      if (saved.changes !== 1) throw new Error('记录不存在，请刷新后重试')
    } else {
      const templateId = randomUUID()
      this.db.prepare('INSERT INTO templates VALUES (?, ?, ?, ?)').run(templateId, data.name, customTypePrefix + safeName(data.name), JSON.stringify(data.rules))
    }
  }
  deleteTemplate(value: string) {
    this.get('templates', value)
    if (this.libraryMode && this.db.prepare('SELECT 1 FROM event_templates WHERE template_id=? LIMIT 1').get(value)) throw new Error('文件已被事项使用，不能删除')
    if (this.all('projects').some(p => JSON.parse(p.template_ids).includes(value))) throw new Error('流程仍被项目使用，请先调整项目设置')
    if (this.db.prepare('SELECT 1 FROM events WHERE template_id=? LIMIT 1').get(value)) throw new Error('流程已被事项使用，不能删除')
    this.db.prepare('DELETE FROM templates WHERE id=?').run(value)
    this.reconcilePendingView()
  }
  importTemplates(value: string, sources: string[]) {
    this.get('templates', value)
    if (this.libraryMode) {
      if (sources.length !== 1) throw new Error('每个文件模板只能导入一份文件')
      if (this.db.prepare('SELECT 1 FROM assets WHERE template_id=? LIMIT 1').get(value)) throw new Error('请先移除原模板文件记录，再导入新文件')
    }
    this.atomic((files, dirs) => {
      const target = this.mkdir(this.templateRoot, value, dirs)
      for (const source of sources) {
        const copied = this.copy(source, target, files)
        this.db.prepare('INSERT INTO assets VALUES (?, ?, ?, ?)').run(randomUUID(), value, path.basename(source), path.relative(this.templateRoot, copied))
      }
    })
  }
  removeTemplateAsset(value: string) { this.get('assets', value); this.db.prepare('DELETE FROM assets WHERE id=?').run(value) }
  exportTemplates(values: string[], destination: string) {
    z.array(id).min(1).max(1000).parse(values)
    const root = directory(destination)
    return this.atomic((files) => {
      for (const value of [...new Set(values)]) { const a = this.get('assets', value); this.copy(inside(this.templateRoot, a.path), root, files) }
      return files.length
    })
  }
  private copyTemplates(projectId: string, root: string, templateIds: string[], files: string[], dirs: string[]) {
    for (const templateId of [...new Set(templateIds)]) {
      const template = this.get('templates', templateId)
      const assets = this.db.prepare('SELECT * FROM assets WHERE template_id=?').all(templateId) as Row[]
      for (const asset of assets) {
        if (this.db.prepare('SELECT 1 FROM project_copies WHERE project_id=? AND asset_id=?').get(projectId, asset.id)) continue
        const target = this.mkdir(root, path.join('模板文件', workflowFolder(template.type)), dirs)
        this.copy(inside(this.templateRoot, asset.path), target, files)
        this.db.prepare('INSERT INTO project_copies VALUES (?, ?)').run(projectId, asset.id)
      }
    }
  }
  saveProject(input: unknown, parent?: string): string {
    const data = projectSchema.parse(input), projectName = safeName(data.name)
    for (const value of data.templateIds) this.get('templates', value)
    if (!data.id) {
      const projectParent = parent ?? this.projectRoot
      if (!projectParent) throw new Error('请先选择项目上级文件夹')
      const root = path.join(directory(projectParent), projectName), projectId = randomUUID()
      this.atomic((files, dirs) => {
        fs.mkdirSync(root); dirs.push(root)
        const marker = path.join(root, '.workpack-project.json')
        fs.writeFileSync(marker, JSON.stringify({ id: projectId, version: 1 }), { flag: 'wx' }); files.push(marker)
        this.db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(projectId, projectName, data.customer, data.contact, data.owner, data.note, root, JSON.stringify(data.templateIds))
        this.copyTemplates(projectId, root, data.templateIds, files, dirs)
      })
      return projectId
    } else {
      const previous = this.get('projects', data.id), oldRoot = this.root(previous)
      const newRoot = path.join(path.dirname(oldRoot), projectName)
      let renamed = false
      try {
        if (newRoot !== oldRoot) {
          if (fs.existsSync(newRoot)) throw new Error('目标目录已存在，请使用其他项目名称')
          fs.renameSync(oldRoot, newRoot); renamed = true
        }
        this.atomic((files, dirs) => {
          this.copyTemplates(data.id!, newRoot, data.templateIds, files, dirs)
          this.db.prepare('UPDATE projects SET name=?, customer=?, contact=?, owner=?, note=?, folder=?, template_ids=? WHERE id=?').run(projectName, data.customer, data.contact, data.owner, data.note, newRoot, JSON.stringify(data.templateIds), data.id)
        })
      } catch (error) {
        if (renamed) {
          try { fs.renameSync(newRoot, oldRoot) }
          catch { throw new Error(`保存失败且目录名称未能还原，请将 ${newRoot} 重新定位到本项目`) }
        }
        throw error
      }
      return data.id
    }
  }
  deleteProject(value: string) {
    const project = this.get('projects', value)
    this.db.transaction(() => {
      const events = this.db.prepare('SELECT id FROM events WHERE project_id=?').all(project.id) as Array<{ id: string }>
      for (const event of events) {
        const items = this.db.prepare('SELECT id FROM items WHERE event_id=?').all(event.id) as Array<{ id: string }>
        for (const item of items) this.db.prepare('DELETE FROM attachments WHERE item_id=?').run(item.id)
        this.db.prepare('DELETE FROM items WHERE event_id=?').run(event.id)
      }
      this.db.prepare('DELETE FROM events WHERE project_id=?').run(project.id)
      this.db.prepare('DELETE FROM project_copies WHERE project_id=?').run(project.id)
      this.db.prepare('DELETE FROM projects WHERE id=?').run(project.id)
    })()
    this.reconcilePendingView()
  }
  relocateProject(value: string, destination: string) {
    const project = this.get('projects', value), folder = directory(destination)
    const marker = inside(folder, '.workpack-project.json')
    if (!present(marker) || JSON.parse(fs.readFileSync(marker, 'utf8')).id !== value) throw new Error('请选择原项目文件夹，所选目录的项目标记不匹配')
    if (path.basename(folder) !== project.name) throw new Error(`文件夹名称应为“${project.name}”，请先恢复名称`)
    this.db.prepare('UPDATE projects SET folder=? WHERE id=?').run(folder, value)
  }
  projectPath(value: string) { return this.root(this.get('projects', value)) }
  createEvent(input: unknown) {
    const data = eventSchema.parse(input), project = this.get('projects', data.projectId), template = this.get('templates', data.templateId)
    if (!JSON.parse(project.template_ids).includes(data.templateId)) throw new Error('所选模板尚未加入项目，请先编辑项目模板设置')
    const root = this.root(project), eventId = randomUUID(), rules = JSON.parse(template.rules) as Array<{ id: string; name: string; note: string; required: string[]; assetId?: string }>
    const assets = this.db.prepare('SELECT * FROM assets WHERE template_id=?').all(data.templateId) as Row[]
    const usedAssets = new Set<string>()
    this.atomic((files, dirs) => this.db.transaction(() => {
      this.db.prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?)').run(eventId, data.projectId, data.templateId, template.type, data.name, data.date, data.owner)
      for (const rule of rules) {
        const itemId = randomUUID()
        const states = stateMap(rule.required)
        this.db.prepare('INSERT INTO items VALUES (?, ?, ?, ?, ?, ?)').run(itemId, eventId, rule.name, rule.note, JSON.stringify(rule.required), JSON.stringify(states))
        const asset = assets.find(candidate => !usedAssets.has(candidate.id) && (candidate.id === rule.assetId || assetMatchesRule(candidate.name, rule.name)))
        if (asset) {
          const source = inside(this.templateRoot, asset.path)
          if (present(source)) {
            const target = this.mkdir(root, path.join(workflowFolder(template.type), `${data.date}_${eventId}`, itemId), dirs)
            const copied = this.copy(source, target, files)
            this.db.prepare('INSERT INTO attachments VALUES (?, ?, ?, ?, ?)').run(randomUUID(), itemId, path.basename(copied), path.relative(root, copied), new Date().toISOString())
            usedAssets.add(asset.id)
            if (states.prepared !== 'na') {
              states.prepared = 'done'
              this.db.prepare('UPDATE items SET states=? WHERE id=?').run(JSON.stringify(states), itemId)
            }
          }
        }
      }
    })())
    return eventId
  }
  updateEvent(input: unknown) {
    const data = eventUpdateSchema.parse(input), event = this.get('events', data.id)
    if (event.project_id !== data.projectId || event.template_id !== data.templateId) throw new Error('事项所属项目或模板不能修改')
    const project = this.get('projects', data.projectId), root = this.root(project)
    const oldDir = inside(root, path.join(workflowFolder(event.type), `${event.date}_${event.id}`))
    const newDir = inside(root, path.join(workflowFolder(event.type), `${data.date}_${event.id}`))
    let renamed = false
    try {
      if (oldDir !== newDir && fs.existsSync(oldDir)) {
        if (fs.existsSync(newDir)) throw new Error('新的事项日期目录已存在，请使用其他日期')
        fs.renameSync(oldDir, newDir)
        renamed = true
      }
      this.db.transaction(() => {
        if (renamed) {
          const attachments = this.db.prepare('SELECT a.* FROM attachments a JOIN items i ON i.id=a.item_id WHERE i.event_id=?').all(data.id) as Row[]
          for (const attachment of attachments) {
            const current = inside(root, attachment.path), relative = path.relative(oldDir, current)
            this.db.prepare('UPDATE attachments SET path=? WHERE id=?').run(path.relative(root, inside(newDir, relative)), attachment.id)
          }
        }
        this.db.prepare('UPDATE events SET name=?, date=?, owner=? WHERE id=?').run(data.name, data.date, data.owner, data.id)
      })()
    } catch (error) {
      if (renamed) {
        try { fs.renameSync(newDir, oldDir) }
        catch { throw new Error(`事项保存失败且附件目录未能还原，请检查：${newDir}`) }
      }
      throw error
    }
  }
  deleteEvent(value: string) {
    const event = this.get('events', value), project = this.get('projects', event.project_id)
    let root: string | null = null
    try { root = this.root(project) } catch { /* Records can still be removed when the project folder is gone. */ }
    const workflowDir = root ? inside(root, workflowFolder(event.type)) : null
    const eventDir = workflowDir ? inside(workflowDir, `${event.date}_${event.id}`) : null
    const trash = eventDir ? inside(workflowDir!, `.deleting_${event.id}`) : null
    let moved = false
    if (eventDir && trash && fs.existsSync(eventDir)) {
      try { fs.renameSync(eventDir, trash); moved = true }
      catch { throw new Error('事项文件夹中有文件正在使用，请关闭相关文件后重试') }
    }
    try {
      this.db.transaction(() => {
        const items = this.db.prepare('SELECT id FROM items WHERE event_id=?').all(event.id) as Row[]
        for (const item of items) this.db.prepare('DELETE FROM attachments WHERE item_id=?').run(item.id)
        this.db.prepare('DELETE FROM items WHERE event_id=?').run(event.id)
        this.db.prepare('DELETE FROM events WHERE id=?').run(event.id)
      })()
    } catch (error) {
      if (moved) fs.renameSync(trash!, eventDir!)
      throw error
    }
    if (moved) fs.rmSync(trash!, { recursive: true, force: true })
    if (workflowDir && fs.existsSync(workflowDir) && !fs.readdirSync(workflowDir).length) fs.rmdirSync(workflowDir)
  }
  private hasFile(itemId: string, root: string) {
    const attachments = this.db.prepare('SELECT path FROM attachments WHERE item_id=?').all(itemId) as Row[]
    return attachments.some(attachment => {
      try { return present(inside(root, attachment.path)) } catch { return false }
    })
  }
  private completeItems(items: Row[], root: string) {
    for (const item of items) {
      const states = JSON.parse(item.states) as Record<string, string>
      const hasFile = this.hasFile(item.id, root)
      for (const step of steps) if (states[step] === 'pending' && (step !== 'prepared' || hasFile)) states[step] = 'done'
      this.db.prepare('UPDATE items SET states=?, required=? WHERE id=?').run(JSON.stringify(states), JSON.stringify(steps.filter(step => states[step] !== 'na')), item.id)
    }
  }
  completeItem(value: string) {
    const { item, project } = this.projectForItem(value)
    const root = this.root(project)
    this.db.transaction(() => this.completeItems([item], root))()
  }
  completeEvent(value: string) {
    const event = this.get('events', value), project = this.get('projects', event.project_id), root = this.root(project)
    const items = this.db.prepare('SELECT * FROM items WHERE event_id=?').all(event.id) as Row[]
    this.db.transaction(() => this.completeItems(items, root))()
  }
  saveItem(input: unknown) {
    const data = itemSchema.parse(input)
    this.get('events', data.eventId)
    if (data.id) {
      const old = this.get('items', data.id)
      if (old.event_id !== data.eventId) throw new Error('清单项不属于此事项')
      const previous = JSON.parse(old.states)
      const states = Object.fromEntries(steps.map(s => [s, data.required.includes(s) ? previous[s] === 'na' ? 'pending' : previous[s] : 'na']))
      this.db.prepare('UPDATE items SET name=?, note=?, required=?, states=? WHERE id=?').run(data.name, data.note, JSON.stringify(data.required), JSON.stringify(states), data.id)
    } else {
      const itemId = randomUUID()
      this.db.transaction(() => {
        this.db.prepare('INSERT INTO items VALUES (?, ?, ?, ?, ?, ?)').run(itemId, data.eventId, data.name, data.note, JSON.stringify(data.required), JSON.stringify(stateMap(data.required)))
        if (this.libraryMode) this.db.prepare('INSERT INTO document_tasks VALUES (?, ?, ?, 0, 0)').run(randomUUID(), itemId, '准备文件')
      })()
    }
  }
  deleteItem(value: string) { this.get('items', value); this.db.prepare('DELETE FROM items WHERE id=?').run(value) }
  setStatus(input: unknown) {
    const data = statusSchema.parse(input), item = this.get('items', data.id)
    if (data.step === 'prepared' && data.status === 'done') {
      const { project } = this.projectForItem(data.id)
      if (!this.hasFile(data.id, this.root(project))) throw new Error('请先上传文件，再标记为已准备')
    }
    const states = JSON.parse(item.states); states[data.step] = data.status
    const applicable = steps.filter(s => states[s] !== 'na')
    this.db.prepare('UPDATE items SET states=?, required=? WHERE id=?').run(JSON.stringify(states), JSON.stringify(applicable), data.id)
  }
  importAttachments(value: string, sources: string[]) {
    const { item, event, project } = this.projectForItem(value), root = this.root(project)
    this.atomic((files, dirs) => {
      const target = this.mkdir(root, path.join(workflowFolder(event.type), `${event.date}_${event.id}`, item.id), dirs)
      for (const source of sources) {
        const copied = this.copy(source, target, files)
        this.db.prepare('INSERT INTO attachments VALUES (?, ?, ?, ?, ?)').run(randomUUID(), value, path.basename(source), path.relative(root, copied), new Date().toISOString())
      }
      const states = JSON.parse(item.states)
      if (sources.length && states.prepared !== 'na') states.prepared = 'done'
      this.db.prepare('UPDATE items SET states=? WHERE id=?').run(JSON.stringify(states), value)
    })
  }
  attachmentPath(value: string) {
    const a = this.get('attachments', value), { project } = this.projectForItem(a.item_id)
    const file = inside(this.root(project), a.path)
    if (!present(file)) throw new Error('附件已被移动或删除，请重新定位或移除记录')
    if (!/\.(docx?|xlsx?|pptx?|pdf|png|jpe?g|gif|bmp|webp|txt|csv|zip|7z)$/i.test(file)) throw new Error('此文件类型请在项目文件夹中确认后手动打开')
    return file
  }
  relocateAttachment(value: string, source: string) {
    const a = this.get('attachments', value), { item, event, project } = this.projectForItem(a.item_id), root = this.root(project)
    this.atomic((files, dirs) => {
      const target = this.mkdir(root, path.join(workflowFolder(event.type), `${event.date}_${event.id}`, item.id), dirs)
      const copied = this.copy(source, target, files)
      this.db.prepare('UPDATE attachments SET name=?, path=? WHERE id=?').run(path.basename(source), path.relative(root, copied), value)
    })
  }
  removeAttachment(value: string) {
    const attachment = this.get('attachments', value)
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM attachments WHERE id=?').run(value)
      const item = this.get('items', attachment.item_id)
      const states = JSON.parse(item.states)
      const remaining = this.db.prepare('SELECT 1 FROM attachments WHERE item_id=?').get(item.id)
      if (!remaining && states.prepared !== 'na') {
        states.prepared = 'pending'
        this.db.prepare('UPDATE items SET states=? WHERE id=?').run(JSON.stringify(states), item.id)
      }
      if (this.libraryMode && !remaining) this.db.prepare("UPDATE document_tasks SET done=0 WHERE item_id=? AND name='准备文件'").run(item.id)
    })()
  }
  saveLibraryCategory(input: unknown) {
    if (!this.libraryMode) throw new Error('文件库不可用')
    const data = z.object({ id: id.optional(), name }).parse(input)
    if (data.id) { this.get('library_categories', data.id); this.db.prepare('UPDATE library_categories SET name=? WHERE id=?').run(data.name, data.id) }
    else this.db.prepare('INSERT INTO library_categories VALUES (?, ?)').run(randomUUID(), data.name)
  }
  deleteLibraryCategory(value: string) {
    if (!this.libraryMode) throw new Error('文件库不可用')
    this.get('library_categories', value)
    this.db.prepare('DELETE FROM library_categories WHERE id=?').run(value)
  }
  saveLibraryFile(input: unknown) {
    if (!this.libraryMode) throw new Error('文件库不可用')
    const data = z.object({ id: id.optional(), name, purpose: text, categoryId: id.nullish() }).parse(input)
    if (data.categoryId) this.get('library_categories', data.categoryId)
    const fileName = safeName(data.name)
    if (data.id) {
      this.get('templates', data.id)
      this.db.transaction(() => {
        this.db.prepare('UPDATE templates SET name=?, type=? WHERE id=?').run(fileName, customTypePrefix + fileName, data.id)
        this.db.prepare('UPDATE library_meta SET purpose=?, category_id=? WHERE template_id=?').run(data.purpose, data.categoryId ?? null, data.id)
      })()
    } else {
      const fileId = randomUUID()
      this.db.transaction(() => {
        this.db.prepare('INSERT INTO templates VALUES (?, ?, ?, ?)').run(fileId, fileName, customTypePrefix + fileName, '[]')
        this.db.prepare('INSERT INTO library_meta VALUES (?, ?, ?)').run(fileId, data.categoryId ?? null, data.purpose)
      })()
    }
  }
  createLibraryEvent(input: unknown) {
    if (!this.libraryMode) throw new Error('文件库不可用')
    const data = z.object({ projectId: id, templateIds: z.array(id).min(1).max(100).refine(ids => new Set(ids).size === ids.length), name, date: eventSchema.shape.date, owner: name }).parse(input)
    const project = this.get('projects', data.projectId), root = this.root(project)
    const templates = data.templateIds.map(templateId => this.get('templates', templateId))
    const eventId = randomUUID()
    this.atomic((files, dirs) => {
      this.db.prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?)').run(eventId, data.projectId, data.templateIds[0], 'custom:事项', data.name, data.date, data.owner)
      for (const template of templates) {
        this.db.prepare('INSERT INTO event_templates VALUES (?, ?)').run(eventId, template.id)
        const itemId = randomUUID()
        const purpose = (this.db.prepare('SELECT purpose FROM library_meta WHERE template_id=?').get(template.id) as {purpose:string}|undefined)?.purpose ?? ''
        this.db.prepare('INSERT INTO items VALUES (?, ?, ?, ?, ?, ?)').run(itemId, eventId, template.name, purpose, '["prepared"]', JSON.stringify(stateMap(['prepared'])))
        const taskId = randomUUID()
        this.db.prepare('INSERT INTO document_tasks VALUES (?, ?, ?, 0, 0)').run(taskId, itemId, '准备文件')
        const asset = this.db.prepare('SELECT * FROM assets WHERE template_id=? ORDER BY rowid LIMIT 1').get(template.id) as Row | undefined
        if (asset) {
          const source = inside(this.templateRoot, asset.path)
          if (!present(source)) throw new Error(`模板文件已失效：${template.name}`)
          const target = this.mkdir(root, path.join('事项', `${data.date}_${eventId}`, itemId), dirs)
          const copied = this.copy(source, target, files)
          this.db.prepare('INSERT INTO attachments VALUES (?, ?, ?, ?, ?)').run(randomUUID(), itemId, path.basename(copied), path.relative(root, copied), new Date().toISOString())
        }
      }
    })
    return eventId
  }
  saveDocumentTask(input: unknown) {
    if (!this.libraryMode) throw new Error('文件库不可用')
    const data = z.object({ id: id.optional(), itemId: id, name }).parse(input)
    this.get('items', data.itemId)
    if (!data.id && data.name === '准备文件') throw new Error('准备文件已自动加入清单')
    if (data.id) {
      const task = this.get('document_tasks', data.id)
      if (task.item_id !== data.itemId) throw new Error('待办不属于此文件')
      this.db.prepare('UPDATE document_tasks SET name=? WHERE id=?').run(data.name, data.id)
    } else {
      const next = (this.db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS position FROM document_tasks WHERE item_id=?').get(data.itemId) as {position:number}).position
      this.db.prepare('INSERT INTO document_tasks VALUES (?, ?, ?, 0, ?)').run(randomUUID(), data.itemId, data.name, next)
    }
  }
  setDocumentTaskDone(input: unknown) {
    if (!this.libraryMode) throw new Error('文件库不可用')
    const data = z.object({ id, done: z.boolean() }).parse(input), task = this.get('document_tasks', data.id)
    if (data.done && task.name === '准备文件') {
      const { project } = this.projectForItem(task.item_id)
      if (!this.hasFile(task.item_id, this.root(project))) throw new Error('请先添加文件，再勾选准备文件')
    }
    this.db.prepare('UPDATE document_tasks SET done=? WHERE id=?').run(data.done ? 1 : 0, data.id)
  }
  deleteDocumentTask(value: string) {
    if (!this.libraryMode) throw new Error('文件库不可用')
    const task = this.get('document_tasks', value)
    if (task.name === '准备文件') throw new Error('准备文件是默认待办')
    this.db.prepare('DELETE FROM document_tasks WHERE id=?').run(value)
  }
}
