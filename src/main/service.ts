import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { normalizePendingViewState, parsePendingViewState, PENDING_VIEW_PREFERENCE_KEY, serializePendingViewState, type PendingViewState, type Snapshot, type Project, type Template, type Item, type BusinessEvent } from '../shared/model'

const name = z.string().trim().min(1, '名称不能为空').max(100)
const text = z.string().max(4000)
const id = z.string().uuid()
const projectSchema = z.object({ id: id.optional(), name, customer: name, contact: text, owner: name, note: text })
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const date = new Date(value); return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value }, '日期无效')
const eventUpdateSchema = z.object({ id, projectId: id, name, date: dateSchema, owner: name })
const itemSchema = z.object({ id: id.optional(), eventId: id, name, note: text })
type Row = Record<string, any>

/** Windows limits one path component to 255 UTF-16 code units. */
const maxFileName = 255
function windowsSafe(result: string) {
  if (/[<>:"/\\|?*\x00-\x1f]/.test(result) || /[. ]$/.test(result) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(result) || result === '.' || result === '..') throw new Error('名称不能包含 Windows 保留名称、特殊字符或末尾句点')
  return result
}
export function safeName(value: string): string { return windowsSafe(name.parse(value)) }
export function safeFileName(value: string): string {
  if (!value.trim()) throw new Error('文件名不能为空')
  if (value.length > maxFileName) throw new Error(`文件名不能超过 ${maxFileName} 个字符`)
  return windowsSafe(value)
}
/** `name (n).ext`, shortening the name rather than the extension so the result stays a valid file name. */
export function numberedFileName(original: string, n: number): string {
  const { name: stem, ext } = path.parse(original), suffix = ` (${n})`
  const room = maxFileName - suffix.length - ext.length
  if (room < 1) throw new Error('文件扩展名过长，无法生成不重名的文件名')
  const chars = Array.from(stem)
  while (chars.join('').length > room) chars.pop()
  const shortened = chars.join('').replace(/[. ]+$/, '')
  return `${shortened || '_'}${suffix}${ext}`
}
function directory(value: string) {
  if (!path.isAbsolute(value) || !fs.statSync(value).isDirectory()) throw new Error('目录不存在，请重新选择')
  return fs.realpathSync(value)
}
export function inside(root: string, relative: string, area = '项目'): string {
  const target = path.resolve(root, relative)
  const rel = path.relative(root, target)
  if (path.isAbsolute(relative) || !rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`文件路径超出${area}目录`)
  let check = target
  while (check !== root) {
    if (fs.existsSync(check) && fs.lstatSync(check).isSymbolicLink()) throw new Error(`${area}内包含符号链接，请使用普通文件夹`)
    check = path.dirname(check)
  }
  return target
}
export function isSameOrInside(child: string, parent: string) {
  const relative = path.relative(parent, child)
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}
function real(value: string) { try { return fs.realpathSync(value) } catch { return path.resolve(value) } }
function sameEntry(a: string, b: string) {
  try {
    const left = fs.statSync(a, { bigint: true }), right = fs.statSync(b, { bigint: true })
    return left.dev === right.dev && left.ino === right.ino
  } catch { return false }
}
/** Rows keep their table order within each group. */
function groupBy(rows: Row[], key: string) {
  const groups = new Map<string, Row[]>()
  for (const row of rows) {
    const list = groups.get(row[key])
    if (list) list.push(row)
    else groups.set(row[key], [row])
  }
  return groups
}
function present(file: string) { try { return fs.statSync(file).isFile() } catch { return false } }
function folderPresent(file: string) { try { return fs.statSync(file).isDirectory() } catch { return false } }
export const libraryDatabaseFile = 'workpack-v3.sqlite'

/** All disk access is in the main process. Rollbacks only remove paths created by this operation. */
export class WorkPackService {
  db: Database.Database
  templateRoot: string
  projectRoot?: string
  constructor(readonly dataDirectory: string, readonly copyFile = fs.copyFileSync, locations: { templateRoot?: string; projectRoot?: string; databaseMustExist?: boolean } = {}) {
    if (!locations.databaseMustExist) fs.mkdirSync(dataDirectory, { recursive: true })
    this.templateRoot = locations.templateRoot ?? path.join(dataDirectory, 'templates')
    this.projectRoot = locations.projectRoot
    if (!locations.templateRoot) fs.mkdirSync(this.templateRoot, { recursive: true })
    this.db = new Database(path.join(dataDirectory, libraryDatabaseFile), { fileMustExist: Boolean(locations.databaseMustExist) })
    this.db.pragma('foreign_keys = ON')
    // WAL keeps recent commits in workpack-v3.sqlite-wal. Copying only the main file while this connection is open can miss them.
    this.db.pragma('journal_mode = WAL')
    const version = this.db.pragma('user_version', { simple: true }) as number
    if (version > 2) { this.db.close(); throw new Error('数据来自更新版本，请使用新版 WorkPack 打开') }
    if (version < 1) this.db.transaction(() => {
      // Keep the v3 schema compatible with databases created by earlier builds.
      // The former workflow/status columns are inert placeholders for existing rows.
      this.db.exec(`
        CREATE TABLE templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, rules TEXT NOT NULL);
        CREATE TABLE assets (id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE, name TEXT NOT NULL, path TEXT NOT NULL);
        CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, customer TEXT NOT NULL, contact TEXT NOT NULL, owner TEXT NOT NULL, note TEXT NOT NULL, folder TEXT NOT NULL UNIQUE, template_ids TEXT NOT NULL);
        CREATE TABLE events (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), template_id TEXT NOT NULL, type TEXT NOT NULL, name TEXT NOT NULL, date TEXT NOT NULL, owner TEXT NOT NULL);
        CREATE TABLE items (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), name TEXT NOT NULL, note TEXT NOT NULL, required TEXT NOT NULL, states TEXT NOT NULL);
        CREATE TABLE attachments (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE, name TEXT NOT NULL, path TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE INDEX events_project ON events(project_id);
        CREATE INDEX items_event ON items(event_id);
        CREATE INDEX attachments_item ON attachments(item_id);
        PRAGMA user_version = 1;
      `)
    })()
    if ((this.db.pragma('user_version', { simple: true }) as number) < 2) this.db.transaction(() => {
      this.db.exec(`CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL); PRAGMA user_version = 2;`)
    })()
    this.db.exec(`CREATE TABLE IF NOT EXISTS library_categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS library_meta (template_id TEXT PRIMARY KEY REFERENCES templates(id) ON DELETE CASCADE, category_id TEXT REFERENCES library_categories(id) ON DELETE SET NULL, purpose TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS event_templates (event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, template_id TEXT NOT NULL, PRIMARY KEY(event_id, template_id));
      CREATE TABLE IF NOT EXISTS document_tasks (id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE, name TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS document_tasks_item ON document_tasks(item_id, position);
      CREATE INDEX IF NOT EXISTS assets_template ON assets(template_id);
      CREATE INDEX IF NOT EXISTS event_templates_template ON event_templates(template_id);
      CREATE TABLE IF NOT EXISTS pending_operations (id TEXT PRIMARY KEY, kind TEXT NOT NULL, payload TEXT NOT NULL);`)
    this.ensureItemTemplateLink()
    this.db.transaction(() => {
      for (const event of this.all('events')) this.reconcileEventTemplates(event.id)
    })()
    this.recoverOperations()
  }
  /** Recorded before a folder is moved; removed in the same transaction that commits the records. */
  private beginOperation(kind: string, payload: Record<string, string>) {
    const operation = randomUUID()
    this.db.prepare('INSERT INTO pending_operations VALUES (?, ?, ?)').run(operation, kind, JSON.stringify(payload))
    return operation
  }
  private endOperation(operation: string) { this.db.prepare('DELETE FROM pending_operations WHERE id=?').run(operation) }
  /** Settles folder moves interrupted by a crash. Each step can be repeated; an unreachable folder keeps its record for the next launch. */
  private recoverOperations() {
    for (const operation of this.all('pending_operations')) {
      let settled = false
      try { settled = this.recover(operation.kind, JSON.parse(operation.payload)) } catch { /* The folder may be offline or in use. */ }
      if (settled) this.endOperation(operation.id)
    }
  }
  private recover(kind: string, p: Record<string, string>): boolean {
    if (!folderPresent(p.root)) return false
    if (kind === 'delete-event') {
      const kept = this.db.prepare('SELECT 1 FROM events WHERE id=?').get(p.eventId)
      if (!fs.existsSync(p.trash)) return true
      if (!kept) { fs.rmSync(p.trash, { recursive: true, force: true }); return true }
      if (fs.existsSync(p.eventDir)) return false
      fs.renameSync(p.trash, p.eventDir)
      return true
    }
    return false
  }
  /** Items created before the file link existed are matched once by name within the matter. */
  private ensureItemTemplateLink() {
    const columns = this.db.prepare('PRAGMA table_info(items)').all() as Array<{ name: string }>
    if (columns.some(column => column.name === 'template_id')) return
    this.db.transaction(() => {
      this.db.exec('ALTER TABLE items ADD COLUMN template_id TEXT')
      const templates = new Map((this.db.prepare('SELECT id, name FROM templates').all() as Array<{ id: string; name: string }>).map(row => [row.id, row.name]))
      const links = this.db.prepare('SELECT event_id, template_id FROM event_templates ORDER BY rowid').all() as Array<{ event_id: string; template_id: string }>
      const items = this.db.prepare('SELECT id, event_id, name FROM items').all() as Array<{ id: string; event_id: string; name: string }>
      const claimed = new Set<string>()
      const update = this.db.prepare('UPDATE items SET template_id=? WHERE id=?')
      for (const item of items) {
        const matches = links.filter(link => link.event_id === item.event_id && templates.get(link.template_id) === item.name && !claimed.has(`${link.event_id}\0${link.template_id}`))
        if (matches.length !== 1) continue
        claimed.add(`${item.event_id}\0${matches[0].template_id}`)
        update.run(matches[0].template_id, item.id)
      }
    })()
  }
  close() { this.db.close() }
  projectFolders(): string[] { return (this.db.prepare('SELECT folder FROM projects').all() as Array<{ folder: string }>).map(row => real(row.folder)) }
  /** A recursive delete under `directory` must not reach a storage root or another project. */
  private assertNothingManagedInside(directory: string, ownProject: string) {
    const roots = [this.dataDirectory, this.templateRoot, ...(this.projectRoot ? [this.projectRoot] : []), ...this.projectFolders()]
    const target = real(directory)
    if (roots.map(real).some(root => root !== real(ownProject) && isSameOrInside(root, target))) throw new Error('事项文件夹中包含存储位置或其他项目，已停止删除。请先在设置中把相关位置移出该事项文件夹')
  }
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
    const original = safeFileName(path.basename(source))
    for (let n = 0; n < 10000; n++) {
      const target = path.join(targetDir, n ? numberedFileName(original, n) : original)
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
    const assets = groupBy(this.all('assets'), 'template_id')
    const metadata = new Map(this.all('library_meta').map(m => [m.template_id, m]))
    const templates = this.all('templates').map(t => ({ ...t, purpose: metadata.get(t.id)?.purpose ?? '', categoryId: metadata.get(t.id)?.category_id ?? null, assets: (assets.get(t.id) ?? []).map(a => {
      let exists = false
      try { exists = present(inside(this.templateRoot, a.path)) } catch { /* Keep unavailable assets visible. */ }
      return { id: a.id, name: a.name, path: a.path, exists }
    }) })) as Template[]
    const allEvents = groupBy(this.all('events'), 'project_id'), allItems = groupBy(this.all('items'), 'event_id'), attachments = groupBy(this.all('attachments'), 'item_id')
    const tasks = groupBy(this.all('document_tasks'), 'item_id')
    const eventTemplates = groupBy(this.all('event_templates'), 'event_id')
    const projects = this.all('projects').map(p => {
      let folderExists = false
      try { this.root(p); folderExists = true } catch { /* A replaced directory is not the original project. */ }
      return {
      id: p.id, name: p.name, customer: p.customer, contact: p.contact, owner: p.owner, note: p.note, folder: p.folder, folderExists,
      events: (allEvents.get(p.id) ?? []).map(e => ({
        id: e.id, projectId: p.id, templateId: e.template_id, templateIds: (eventTemplates.get(e.id) ?? []).map(link => link.template_id), name: e.name, date: e.date, owner: e.owner,
        items: (allItems.get(e.id) ?? []).map(i => ({
          id: i.id, eventId: e.id, name: i.name, note: i.note, templateId: i.template_id ?? null, tasks: (tasks.get(i.id) ?? []).sort((a,b) => a.position - b.position).map(task => ({ id: task.id, itemId: i.id, name: task.name, done: Boolean(task.done), position: task.position })),
          attachments: (attachments.get(i.id) ?? []).map(a => {
            let exists = false
            try { exists = folderExists && present(inside(p.folder, a.path)) } catch { /* Invalid paths are shown as missing. */ }
            return { id: a.id, itemId: i.id, name: a.name, path: a.path, createdAt: a.created_at, exists }
          })
        })) as Item[]
      })) as BusinessEvent[]
    }}) as Project[]
    for (const project of projects) for (const event of project.events) for (const item of event.items) {
      if (!item.attachments.some(a => a.exists)) for (const task of item.tasks ?? []) if (task.position === 0) task.done = false
    }
    return { projects, templates: templates.map(template => ({ id: template.id, name: template.name, purpose: template.purpose, categoryId: template.categoryId, assets: template.assets })), categories: this.all('library_categories') as {id:string;name:string}[], pendingView: this.reconcilePendingView() }
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
    return { projectIds: (this.db.prepare('SELECT id FROM projects').all() as Array<{ id: string }>).map(row => row.id) }
  }
  private reconcilePendingView(): PendingViewState {
    const raw = this.preference(PENDING_VIEW_PREFERENCE_KEY)
    const normalized = normalizePendingViewState(parsePendingViewState(raw), this.pendingFilterIds())
    const serialized = serializePendingViewState(normalized)
    if (raw !== null && raw !== serialized) this.writePreference(PENDING_VIEW_PREFERENCE_KEY, serialized)
    return normalized
  }
  deleteLibraryFile(value: string) {
    this.get('templates', value)
    if (this.db.prepare('SELECT 1 FROM event_templates WHERE template_id=? LIMIT 1').get(value)) throw new Error('文件已被事项使用，不能删除')
    this.db.prepare('DELETE FROM templates WHERE id=?').run(value)
  }
  importLibraryFile(value: string, sources: string[]) {
    this.get('templates', value)
    if (sources.length !== 1) throw new Error('每个文件模板只能导入一份文件')
    if (this.db.prepare('SELECT 1 FROM assets WHERE template_id=? LIMIT 1').get(value)) throw new Error('请先移除原模板文件记录，再导入新文件')
    if (!folderPresent(this.templateRoot)) throw new Error('模板存储位置当前不可用，请连接所在磁盘或在设置中重新选择')
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
  saveProject(input: unknown): string {
    const data = projectSchema.parse(input), projectName = safeName(data.name)
    if (!data.id) {
      const projectParent = this.projectRoot
      if (!projectParent) throw new Error('请先选择项目上级文件夹')
      if (!folderPresent(projectParent)) throw new Error('项目存储位置当前不可用，请连接所在磁盘或在设置中重新选择')
      const root = path.join(directory(projectParent), projectName), projectId = randomUUID()
      this.atomic((files, dirs) => {
        fs.mkdirSync(root); dirs.push(root)
        const marker = path.join(root, '.workpack-project.json')
        fs.writeFileSync(marker, JSON.stringify({ id: projectId, version: 1 }), { flag: 'wx' }); files.push(marker)
        this.db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(projectId, projectName, data.customer, data.contact, data.owner, data.note, root, '[]')
      })
      return projectId
    } else {
      const previous = this.get('projects', data.id), oldRoot = this.root(previous)
      const newRoot = path.join(path.dirname(oldRoot), projectName)
      let renamed = false
      try {
        if (newRoot !== oldRoot) {
          // A case-only change on a case-insensitive disk resolves to the project's own folder.
          if (fs.existsSync(newRoot) && !sameEntry(newRoot, oldRoot)) throw new Error('目标目录已存在，请使用其他项目名称')
          fs.renameSync(oldRoot, newRoot); renamed = true
        }
        this.atomic((files, dirs) => {
          this.db.prepare('UPDATE projects SET name=?, customer=?, contact=?, owner=?, note=?, folder=? WHERE id=?').run(projectName, data.customer, data.contact, data.owner, data.note, newRoot, data.id)
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
  updateEvent(input: unknown) {
    const data = eventUpdateSchema.parse(input), event = this.get('events', data.id)
    if (event.project_id !== data.projectId) throw new Error('事项所属项目不能修改')
    const project = this.get('projects', data.projectId), root = this.root(project)
    const oldDir = inside(root, path.join('事项', `${event.date}_${event.id}`))
    const newDir = inside(root, path.join('事项', `${data.date}_${event.id}`))
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
    const eventsDir = root ? inside(root, '事项') : null
    const eventDir = eventsDir ? inside(eventsDir, `${event.date}_${event.id}`) : null
    const trash = eventDir ? inside(eventsDir!, `.deleting_${event.id}`) : null
    let moved = false, operation: string | null = null
    if (eventDir && trash && fs.existsSync(eventDir)) {
      this.assertNothingManagedInside(eventDir, root!)
      operation = this.beginOperation('delete-event', { eventId: event.id, root: root!, eventDir, trash })
      try { fs.renameSync(eventDir, trash); moved = true }
      catch { this.endOperation(operation); throw new Error('事项文件夹中有文件正在使用，请关闭相关文件后重试') }
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
      if (operation) this.endOperation(operation)
      throw error
    }
    if (moved) {
      try { fs.rmSync(trash!, { recursive: true, force: true }); this.endOperation(operation!) }
      catch { /* The records are gone; the next launch removes the staged folder. */ }
    }
    if (eventsDir && fs.existsSync(eventsDir) && !fs.readdirSync(eventsDir).length) fs.rmdirSync(eventsDir)
  }
  private hasFile(itemId: string, root: string) {
    const attachments = this.db.prepare('SELECT path FROM attachments WHERE item_id=?').all(itemId) as Row[]
    return attachments.some(attachment => {
      try { return present(inside(root, attachment.path)) } catch { return false }
    })
  }
  saveItem(input: unknown) {
    const data = itemSchema.parse(input)
    this.get('events', data.eventId)
    if (data.id) {
      const old = this.get('items', data.id)
      if (old.event_id !== data.eventId) throw new Error('清单项不属于此事项')
      this.db.prepare('UPDATE items SET name=?, note=? WHERE id=?').run(data.name, data.note, data.id)
    } else {
      const itemId = randomUUID()
      this.db.transaction(() => {
        this.db.prepare('INSERT INTO items (id, event_id, name, note, required, states) VALUES (?, ?, ?, ?, ?, ?)').run(itemId, data.eventId, data.name, data.note, '[]', '{}')
        this.db.prepare('INSERT INTO document_tasks VALUES (?, ?, ?, 0, 0)').run(randomUUID(), itemId, '准备文件')
      })()
    }
  }
  private reconcileEventTemplates(eventId: string) {
    // A renamed legacy item may have no recoverable template ID. Keep ambiguous
    // references until those items are removed; never guess a link from row order.
    this.db.prepare(`DELETE FROM event_templates WHERE event_id=?
      AND NOT EXISTS (SELECT 1 FROM items WHERE event_id=event_templates.event_id AND template_id IS NULL)
      AND NOT EXISTS (SELECT 1 FROM items WHERE event_id=event_templates.event_id AND template_id=event_templates.template_id)`).run(eventId)
    this.db.prepare(`UPDATE events SET template_id=COALESCE(
      (SELECT template_id FROM event_templates WHERE event_id=events.id ORDER BY rowid LIMIT 1), '')
      WHERE id=? AND NOT EXISTS (SELECT 1 FROM event_templates WHERE event_id=events.id AND template_id=events.template_id)`).run(eventId)
  }
  deleteItem(value: string) {
    const item = this.get('items', value)
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM items WHERE id=?').run(value)
      if (item.template_id) this.db.prepare(`DELETE FROM event_templates WHERE event_id=? AND template_id=?
        AND NOT EXISTS (SELECT 1 FROM items WHERE event_id=? AND template_id=?)`)
        .run(item.event_id, item.template_id, item.event_id, item.template_id)
      this.reconcileEventTemplates(item.event_id)
    })()
  }
  importAttachments(value: string, sources: string[]) {
    const { item, event, project } = this.projectForItem(value), root = this.root(project)
    this.atomic((files, dirs) => {
      const target = this.mkdir(root, path.join('事项', `${event.date}_${event.id}`, item.id), dirs)
      for (const source of sources) {
        const copied = this.copy(source, target, files)
        this.db.prepare('INSERT INTO attachments VALUES (?, ?, ?, ?, ?)').run(randomUUID(), value, path.basename(source), path.relative(root, copied), new Date().toISOString())
      }
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
      const target = this.mkdir(root, path.join('事项', `${event.date}_${event.id}`, item.id), dirs)
      const copied = this.copy(source, target, files)
      this.db.prepare('UPDATE attachments SET name=?, path=? WHERE id=?').run(path.basename(source), path.relative(root, copied), value)
    })
  }
  removeAttachment(value: string) {
    const attachment = this.get('attachments', value)
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM attachments WHERE id=?').run(value)
      const remaining = this.db.prepare('SELECT 1 FROM attachments WHERE item_id=?').get(attachment.item_id)
      if (!remaining) this.db.prepare('UPDATE document_tasks SET done=0 WHERE item_id=? AND position=0').run(attachment.item_id)
    })()
  }
  saveLibraryCategory(input: unknown) {
    const data = z.object({ id: id.optional(), name }).parse(input)
    if (data.id) { this.get('library_categories', data.id); this.db.prepare('UPDATE library_categories SET name=? WHERE id=?').run(data.name, data.id) }
    else this.db.prepare('INSERT INTO library_categories VALUES (?, ?)').run(randomUUID(), data.name)
  }
  deleteLibraryCategory(value: string) {
    this.get('library_categories', value)
    this.db.prepare('DELETE FROM library_categories WHERE id=?').run(value)
  }
  saveLibraryFile(input: unknown) {
    const data = z.object({ id: id.optional(), name, purpose: text, categoryId: id.nullish() }).parse(input)
    if (data.categoryId) this.get('library_categories', data.categoryId)
    const fileName = safeName(data.name)
    if (data.id) {
      this.get('templates', data.id)
      this.db.transaction(() => {
        this.db.prepare('UPDATE templates SET name=?, type=? WHERE id=?').run(fileName, 'file', data.id)
        this.db.prepare('UPDATE library_meta SET purpose=?, category_id=? WHERE template_id=?').run(data.purpose, data.categoryId ?? null, data.id)
      })()
    } else {
      const fileId = randomUUID()
      this.db.transaction(() => {
        this.db.prepare('INSERT INTO templates VALUES (?, ?, ?, ?)').run(fileId, fileName, 'file', '[]')
        this.db.prepare('INSERT INTO library_meta VALUES (?, ?, ?)').run(fileId, data.categoryId ?? null, data.purpose)
      })()
    }
  }
  createLibraryEvent(input: unknown) {
    const data = z.object({ projectId: id, templateIds: z.array(id).min(1).max(100).refine(ids => new Set(ids).size === ids.length), name, date: dateSchema, owner: name }).parse(input)
    const project = this.get('projects', data.projectId), root = this.root(project)
    const templates = data.templateIds.map(templateId => this.get('templates', templateId))
    const eventId = randomUUID()
    this.atomic((files, dirs) => {
      this.db.prepare('INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?)').run(eventId, data.projectId, data.templateIds[0], '事项', data.name, data.date, data.owner)
      for (const template of templates) {
        this.db.prepare('INSERT INTO event_templates VALUES (?, ?)').run(eventId, template.id)
        const itemId = randomUUID()
        const purpose = (this.db.prepare('SELECT purpose FROM library_meta WHERE template_id=?').get(template.id) as {purpose:string}|undefined)?.purpose ?? ''
        this.db.prepare('INSERT INTO items (id, event_id, name, note, required, states, template_id) VALUES (?, ?, ?, ?, ?, ?, ?)').run(itemId, eventId, template.name, purpose, '[]', '{}', template.id)
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
    const data = z.object({ id: id.optional(), itemId: id, name }).parse(input)
    this.get('items', data.itemId)
    const task = data.id ? this.get('document_tasks', data.id) : undefined
    if (task && task.item_id !== data.itemId) throw new Error('待办不属于此文件')
    if (task?.name === '准备文件' && data.name !== '准备文件') throw new Error('准备文件是默认待办，不能修改')
    if (data.name === '准备文件' && task?.name !== '准备文件') throw new Error('准备文件已自动加入清单')
    if (task) {
      this.db.prepare('UPDATE document_tasks SET name=? WHERE id=?').run(data.name, data.id)
    } else {
      const next = (this.db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS position FROM document_tasks WHERE item_id=?').get(data.itemId) as {position:number}).position
      this.db.prepare('INSERT INTO document_tasks VALUES (?, ?, ?, 0, ?)').run(randomUUID(), data.itemId, data.name, next)
    }
  }
  setDocumentTaskDone(input: unknown) {
    const data = z.object({ id, done: z.boolean() }).parse(input), task = this.get('document_tasks', data.id)
    if (data.done && task.position === 0) {
      const { project } = this.projectForItem(task.item_id)
      if (!this.hasFile(task.item_id, this.root(project))) throw new Error('请先添加文件，再勾选准备文件')
    }
    this.db.prepare('UPDATE document_tasks SET done=? WHERE id=?').run(data.done ? 1 : 0, data.id)
  }
  deleteDocumentTask(value: string) {
    const task = this.get('document_tasks', value)
    if (task.position === 0) throw new Error('准备文件是默认待办')
    this.db.prepare('DELETE FROM document_tasks WHERE id=?').run(value)
  }
}
