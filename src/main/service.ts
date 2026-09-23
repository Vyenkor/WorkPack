import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { types, steps, typeLabels, type Snapshot, type Project, type Template, type Item, type Asset, type BusinessEvent } from '../shared/model'

const name = z.string().trim().min(1, '名称不能为空').max(100)
const text = z.string().max(4000)
const id = z.string().uuid()
const required = z.array(z.enum(steps)).max(4).refine(a => new Set(a).size === a.length)
const rule = z.object({ id, name, note: text, required, assetId: id.optional() })
const projectSchema = z.object({ id: id.optional(), name, customer: name, contact: text, owner: name, note: text, templateIds: z.array(id).max(100) })
const templateSchema = z.object({ id: id.optional(), name, type: z.enum(types), rules: z.array(rule).max(200).refine(a => new Set(a.map(r => r.id)).size === a.length) })
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

/** All disk access is in the main process. Rollbacks only remove paths created by this operation. */
export class WorkPackService {
  db: Database.Database
  templateRoot: string
  constructor(readonly dataDirectory: string, readonly copyFile = fs.copyFileSync) {
    fs.mkdirSync(dataDirectory, { recursive: true })
    this.templateRoot = path.join(dataDirectory, 'templates')
    fs.mkdirSync(this.templateRoot, { recursive: true })
    this.db = new Database(path.join(dataDirectory, 'workpack.sqlite'))
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('journal_mode = WAL')
    const version = this.db.pragma('user_version', { simple: true }) as number
    if (version > 1) { this.db.close(); throw new Error('数据来自更新版本，请使用新版 WorkPack 打开') }
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
      for (const type of types) this.db.prepare('INSERT INTO templates VALUES (?, ?, ?, ?)').run(randomUUID(), `${typeLabels[type]}资料模板`, type, JSON.stringify(seeds[type].map(([name, required]) => ({ id: randomUUID(), name, note: '', required }))))
    })()
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
    const templates = this.all('templates').map(t => ({ ...t, rules: JSON.parse(t.rules), assets: assets.filter(a => a.template_id === t.id).map(a => {
      let exists = false
      try { exists = present(inside(this.templateRoot, a.path)) } catch { /* Keep unavailable assets visible. */ }
      return { id: a.id, name: a.name, path: a.path, exists }
    }) })) as Template[]
    const allEvents = this.all('events'), allItems = this.all('items'), attachments = this.all('attachments')
    const projects = this.all('projects').map(p => {
      let folderExists = false
      try { this.root(p); folderExists = true } catch { /* A replaced directory is not the original project. */ }
      return {
      id: p.id, name: p.name, customer: p.customer, contact: p.contact, owner: p.owner, note: p.note, folder: p.folder, templateIds: JSON.parse(p.template_ids), folderExists,
      events: allEvents.filter(e => e.project_id === p.id).map(e => ({
        id: e.id, projectId: p.id, templateId: e.template_id, type: e.type, name: e.name, date: e.date, owner: e.owner,
        items: allItems.filter(i => i.event_id === e.id).map(i => ({
          id: i.id, eventId: e.id, name: i.name, note: i.note, required: JSON.parse(i.required), states: JSON.parse(i.states),
          attachments: attachments.filter(a => a.item_id === i.id).map(a => {
            let exists = false
            try { exists = folderExists && present(inside(p.folder, a.path)) } catch { /* Invalid paths are shown as missing. */ }
            return { id: a.id, itemId: i.id, name: a.name, path: a.path, createdAt: a.created_at, exists }
          })
        })) as Item[]
      })) as BusinessEvent[]
    }}) as Project[]
    for (const project of projects) for (const event of project.events) for (const item of event.items) {
      if (item.attachments.length && !item.attachments.some(a => a.exists) && item.states.prepared === 'done') item.states.prepared = 'pending'
    }
    return { projects, templates, dataDirectory: this.dataDirectory }
  }
  saveTemplate(input: unknown) {
    const data = templateSchema.parse(input)
    if (data.id) {
      const previous = this.get('templates', data.id)
      if (previous.type !== data.type) throw new Error('已有模板不能修改业务类型，请新建模板')
      this.db.prepare('UPDATE templates SET name=?, rules=? WHERE id=?').run(data.name, JSON.stringify(data.rules), data.id)
    } else this.db.prepare('INSERT INTO templates VALUES (?, ?, ?, ?)').run(randomUUID(), data.name, data.type, JSON.stringify(data.rules))
  }
  deleteTemplate(value: string) {
    this.get('templates', value)
    if (this.all('projects').some(p => JSON.parse(p.template_ids).includes(value))) throw new Error('模板仍被项目设为默认模板，请先调整项目设置')
    if (this.db.prepare('SELECT 1 FROM events WHERE template_id=? LIMIT 1').get(value)) throw new Error('模板已被业务事项使用，不能删除')
    this.db.prepare('DELETE FROM templates WHERE id=?').run(value)
  }
  importTemplates(value: string, sources: string[]) {
    this.get('templates', value)
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
        const target = this.mkdir(root, path.join('模板文件', typeLabels[template.type as keyof typeof typeLabels]), dirs)
        this.copy(inside(this.templateRoot, asset.path), target, files)
        this.db.prepare('INSERT INTO project_copies VALUES (?, ?)').run(projectId, asset.id)
      }
    }
  }
  saveProject(input: unknown, parent?: string) {
    const data = projectSchema.parse(input), projectName = safeName(data.name)
    for (const value of data.templateIds) this.get('templates', value)
    if (!data.id) {
      if (!parent) throw new Error('请先选择项目上级文件夹')
      const root = path.join(directory(parent), projectName), projectId = randomUUID()
      this.atomic((files, dirs) => {
        fs.mkdirSync(root); dirs.push(root)
        const marker = path.join(root, '.workpack-project.json')
        fs.writeFileSync(marker, JSON.stringify({ id: projectId, version: 1 }), { flag: 'wx' }); files.push(marker)
        this.db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(projectId, projectName, data.customer, data.contact, data.owner, data.note, root, JSON.stringify(data.templateIds))
        this.copyTemplates(projectId, root, data.templateIds, files, dirs)
      })
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
    }
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
            const target = this.mkdir(root, path.join(typeLabels[template.type as keyof typeof typeLabels], `${data.date}_${eventId}`, itemId), dirs)
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
    const oldDir = inside(root, path.join(typeLabels[event.type as keyof typeof typeLabels], `${event.date}_${event.id}`))
    const newDir = inside(root, path.join(typeLabels[event.type as keyof typeof typeLabels], `${data.date}_${event.id}`))
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
    const event = this.get('events', value)
    this.db.transaction(() => {
      const items = this.db.prepare('SELECT id FROM items WHERE event_id=?').all(event.id) as Row[]
      for (const item of items) this.db.prepare('DELETE FROM attachments WHERE item_id=?').run(item.id)
      this.db.prepare('DELETE FROM items WHERE event_id=?').run(event.id)
      this.db.prepare('DELETE FROM events WHERE id=?').run(event.id)
    })()
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
    } else this.db.prepare('INSERT INTO items VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), data.eventId, data.name, data.note, JSON.stringify(data.required), JSON.stringify(stateMap(data.required)))
  }
  deleteItem(value: string) { this.get('items', value); this.db.prepare('DELETE FROM items WHERE id=?').run(value) }
  setStatus(input: unknown) {
    const data = statusSchema.parse(input), item = this.get('items', data.id)
    const states = JSON.parse(item.states); states[data.step] = data.status
    const applicable = steps.filter(s => states[s] !== 'na')
    this.db.prepare('UPDATE items SET states=?, required=? WHERE id=?').run(JSON.stringify(states), JSON.stringify(applicable), data.id)
  }
  importAttachments(value: string, sources: string[]) {
    const { item, event, project } = this.projectForItem(value), root = this.root(project)
    this.atomic((files, dirs) => {
      const target = this.mkdir(root, path.join(typeLabels[event.type as keyof typeof typeLabels], `${event.date}_${event.id}`, item.id), dirs)
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
      const target = this.mkdir(root, path.join(typeLabels[event.type as keyof typeof typeLabels], `${event.date}_${event.id}`, item.id), dirs)
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
    })()
  }
}
