import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { fileDigest, StorageManager, WorkspaceMissingError } from '../src/main/storage'
import { numberedFileName, safeFileName } from '../src/main/service'
import { findSearchTarget, localDateInput, type BusinessEvent, type Project } from '../src/shared/model'

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-issues-'))
  const system = path.join(root, 'system'), projects = path.join(root, 'projects')
  fs.mkdirSync(projects)
  const w = { root, system, projects, manager: new StorageManager(system, projects), cleanup: () => { try { w.manager.close() } catch { /* Already closed by the test. */ } fs.rmSync(root, { recursive: true, force: true }) } }
  return w
}
function file(root: string, name: string, content = 'content') {
  const target = path.join(root, name)
  fs.writeFileSync(target, content)
  return target
}
function seedEvent(manager: StorageManager, root: string) {
  const service = manager.service
  service.saveLibraryFile({ name: '借用单', purpose: '', categoryId: null })
  const template = service.snapshot().templates[0]
  service.importLibraryFile(template.id, [file(root, '借用单.docx')])
  const projectId = service.saveProject({ name: '项目甲', customer: '客户', contact: '', owner: '张三', note: '' })
  const eventId = service.createLibraryEvent({ projectId, templateIds: [template.id], name: '借用', date: '2026-11-07', owner: '张三' })
  const project = service.snapshot().projects[0]
  return { template, projectId, eventId, project, eventDir: path.join(project.folder, '事项', `2026-11-07_${eventId}`) }
}

describe('#50 configured workspace without its database', () => {
  async function moved() {
    const w = workspace()
    const custom = path.join(w.root, 'custom-workspace')
    fs.mkdirSync(custom)
    await w.manager.change('workspace', custom)
    w.manager.service.saveLibraryFile({ name: '签收单', purpose: '', categoryId: null })
    w.manager.close()
    return { ...w, custom: fs.realpathSync(custom) }
  }
  function removeDatabase(directory: string) {
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(path.join(directory, `workpack-v3.sqlite${suffix}`), { force: true })
  }
  it('creates the database on first launch only', () => {
    const w = workspace()
    try { expect(fs.existsSync(path.join(w.system, 'workpack-v3.sqlite'))).toBe(true) }
    finally { w.cleanup() }
  })
  it('refuses to replace a lost database in the default workspace that was never moved', () => {
    const w = workspace()
    try {
      w.manager.service.saveLibraryFile({ name: '签收单', purpose: '', categoryId: null })
      w.manager.close()
      expect(fs.existsSync(path.join(w.system, 'storage.json'))).toBe(false)
      removeDatabase(w.system)
      expect(() => new StorageManager(w.system, w.projects)).toThrow(WorkspaceMissingError)
      expect(fs.existsSync(path.join(w.system, 'workpack-v3.sqlite'))).toBe(false)
      w.manager = new StorageManager(w.system, w.projects, { create: true })
      expect(w.manager.locations.workspace).toBe(fs.realpathSync(w.system))
      expect(w.manager.service.snapshot().templates).toEqual([])
      w.manager.close()
      w.manager = new StorageManager(w.system, w.projects)
      expect(w.manager.service.snapshot().templates).toEqual([])
    } finally { w.cleanup() }
  })
  it('marks a default workspace created by an earlier version on its next launch', () => {
    const w = workspace()
    try {
      w.manager.close()
      fs.rmSync(path.join(w.system, 'workspace.initialized'))
      w.manager = new StorageManager(w.system, w.projects)
      w.manager.close()
      removeDatabase(w.system)
      expect(() => new StorageManager(w.system, w.projects)).toThrow(WorkspaceMissingError)
    } finally { w.cleanup() }
  })
  it('refuses to start with an empty database when the folder was renamed, and can be pointed at the moved folder', async () => {
    const w = await moved()
    try {
      const renamed = path.join(w.root, 'renamed-workspace')
      fs.renameSync(w.custom, renamed)
      expect(() => new StorageManager(w.system, w.projects)).toThrow(WorkspaceMissingError)
      expect(fs.existsSync(w.custom)).toBe(false)
      expect(() => new StorageManager(w.system, w.projects, { locate: w.root })).toThrow(WorkspaceMissingError)
      const located = new StorageManager(w.system, w.projects, { locate: renamed })
      try { expect(located.service.snapshot().templates.map(t => t.name)).toEqual(['签收单']) }
      finally { located.close() }
      const reopened = new StorageManager(w.system, w.projects)
      try { expect(reopened.locations.workspace).toBe(fs.realpathSync(renamed)) }
      finally { reopened.close() }
    } finally { fs.rmSync(w.root, { recursive: true, force: true }) }
  })
  it('refuses to start when only the database file was moved away, and creates a new one only on request', async () => {
    const w = await moved()
    try {
      fs.renameSync(path.join(w.custom, 'workpack-v3.sqlite'), path.join(w.root, 'set-aside.sqlite'))
      for (const suffix of ['-wal', '-shm']) fs.rmSync(path.join(w.custom, `workpack-v3.sqlite${suffix}`), { force: true })
      expect(() => new StorageManager(w.system, w.projects)).toThrow('找不到工作空间数据库')
      expect(fs.existsSync(path.join(w.custom, 'workpack-v3.sqlite'))).toBe(false)
      const created = new StorageManager(w.system, w.projects, { create: true })
      try {
        expect(created.locations.workspace).toBe(w.custom)
        expect(created.service.snapshot().templates).toEqual([])
      } finally { created.close() }
    } finally { fs.rmSync(w.root, { recursive: true, force: true }) }
  })
})

function plan(manager: StorageManager, sql: string, ...params: unknown[]) {
  return (manager.service.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as Array<{ detail: string }>).map(row => row.detail).join('\n')
}

function reopen(w: ReturnType<typeof workspace>) {
  w.manager.close()
  w.manager = new StorageManager(w.system, w.projects)
  return w.manager.service
}
function pendingOperations(manager: StorageManager) {
  return (manager.service.db.prepare('SELECT kind FROM pending_operations').all() as Array<{ kind: string }>).map(row => row.kind)
}

describe('#39 deleting a matter across a crash', () => {
  it('puts the folder back when the process stops after staging it and before the records are deleted', () => {
    const w = workspace()
    try {
      const { eventDir, eventId } = seedEvent(w.manager, w.root)
      const trash = path.join(path.dirname(eventDir), `.deleting_${eventId}`)
      const rename = fs.renameSync
      const renames = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => { if (String(to) === eventDir) throw new Error('进程中断'); rename(from, to) })
      const transaction = vi.spyOn(w.manager.service.db, 'transaction').mockImplementation(() => (() => { throw new Error('进程中断') }) as never)
      try { expect(() => w.manager.service.deleteEvent(eventId)).toThrow('进程中断') }
      finally { renames.mockRestore(); transaction.mockRestore() }
      expect(fs.existsSync(trash)).toBe(true)
      expect(pendingOperations(w.manager)).toEqual(['delete-event'])

      const service = reopen(w)
      expect(fs.existsSync(eventDir)).toBe(true)
      expect(fs.existsSync(trash)).toBe(false)
      expect(pendingOperations(w.manager)).toEqual([])
      expect(service.snapshot().projects[0].events[0].items[0].attachments[0].exists).toBe(true)
      service.deleteEvent(eventId)
      expect(fs.existsSync(eventDir)).toBe(false)
      expect(fs.existsSync(trash)).toBe(false)
    } finally { w.cleanup() }
  })
  it('finishes removing the staged folder when the process stops after the records are deleted', () => {
    const w = workspace()
    try {
      const { eventDir, eventId } = seedEvent(w.manager, w.root)
      const trash = path.join(path.dirname(eventDir), `.deleting_${eventId}`)
      const remove = vi.spyOn(fs, 'rmSync').mockImplementation(() => { throw new Error('进程中断') })
      try { w.manager.service.deleteEvent(eventId) }
      finally { remove.mockRestore() }
      expect(w.manager.service.snapshot().projects[0].events).toEqual([])
      expect(fs.existsSync(trash)).toBe(true)

      reopen(w)
      expect(fs.existsSync(trash)).toBe(false)
      expect(pendingOperations(w.manager)).toEqual([])
      reopen(w)
      expect(pendingOperations(w.manager)).toEqual([])
    } finally { w.cleanup() }
  })
  it('keeps the record while the project folder is offline', () => {
    const w = workspace()
    try {
      const { eventId, project } = seedEvent(w.manager, w.root)
      const remove = vi.spyOn(fs, 'rmSync').mockImplementation(() => { throw new Error('进程中断') })
      try { w.manager.service.deleteEvent(eventId) }
      finally { remove.mockRestore() }
      w.manager.close()
      fs.renameSync(project.folder, `${project.folder}-offline`)
      w.manager = new StorageManager(w.system, w.projects)
      expect(pendingOperations(w.manager)).toEqual(['delete-event'])
      w.manager.close()
      fs.renameSync(`${project.folder}-offline`, project.folder)
      w.manager = new StorageManager(w.system, w.projects)
      expect(pendingOperations(w.manager)).toEqual([])
      expect(fs.existsSync(path.join(project.folder, '事项', `.deleting_${eventId}`))).toBe(false)
    } finally { w.cleanup() }
  })
})

describe('#47 renames interrupted before the records are saved', () => {
  function crashDuring(action: () => void, restoreTarget: string, commit: { mock: () => void }) {
    const rename = fs.renameSync
    const renames = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => { if (String(to) === restoreTarget) throw new Error('进程中断'); rename(from, to) })
    try { commit.mock(); expect(action).toThrow() }
    finally { renames.mockRestore(); vi.restoreAllMocks() }
  }
  it('restores the project folder name on the next launch', () => {
    const w = workspace()
    try {
      const { projectId, project } = seedEvent(w.manager, w.root)
      const input = { customer: '客户', contact: '', owner: '张三', note: '' }
      crashDuring(() => w.manager.service.saveProject({ id: projectId, name: '项目乙', ...input }), project.folder, {
        mock: () => vi.spyOn(w.manager.service as unknown as { atomic: () => never }, 'atomic').mockImplementation(() => { throw new Error('进程中断') })
      })
      expect(fs.existsSync(path.join(w.projects, '项目乙'))).toBe(true)
      expect(pendingOperations(w.manager)).toEqual(['rename-project'])

      const service = reopen(w)
      expect(fs.readdirSync(w.projects)).toEqual(['项目甲'])
      expect(service.snapshot().projects[0]).toMatchObject({ name: '项目甲', folderExists: true })
      expect(service.snapshot().projects[0].events[0].items[0].attachments[0].exists).toBe(true)
      service.saveProject({ id: projectId, name: '项目乙', ...input })
      expect(fs.readdirSync(w.projects)).toEqual(['项目乙'])
      expect(pendingOperations(w.manager)).toEqual([])
    } finally { w.cleanup() }
  })
  it('restores the matter folder date on the next launch', () => {
    const w = workspace()
    try {
      const { projectId, eventId, eventDir, project } = seedEvent(w.manager, w.root)
      const update = { id: eventId, projectId, name: '借用', owner: '张三', date: '2026-11-09' }
      const db = w.manager.service.db
      crashDuring(() => w.manager.service.updateEvent(update), eventDir, {
        mock: () => vi.spyOn(db, 'transaction').mockImplementation(() => (() => { throw new Error('进程中断') }) as never)
      })
      const moved = path.join(project.folder, '事项', `2026-11-09_${eventId}`)
      expect(fs.existsSync(moved)).toBe(true)

      const service = reopen(w)
      expect(fs.existsSync(eventDir)).toBe(true)
      expect(fs.existsSync(moved)).toBe(false)
      expect(service.snapshot().projects[0].events[0].items[0].attachments[0].exists).toBe(true)
      service.updateEvent(update)
      const saved = service.snapshot().projects[0].events[0]
      expect(saved.date).toBe('2026-11-09')
      expect(saved.items[0].attachments[0].exists).toBe(true)
    } finally { w.cleanup() }
  })
  it('keeps the new date across a restart after a retry succeeds where the first save could not roll back', () => {
    const w = workspace()
    try {
      const { projectId, eventId, eventDir, project } = seedEvent(w.manager, w.root)
      const update = { id: eventId, projectId, name: '借用', owner: '张三', date: '2026-11-09' }
      const db = w.manager.service.db
      crashDuring(() => w.manager.service.updateEvent(update), eventDir, {
        mock: () => vi.spyOn(db, 'transaction').mockImplementation(() => (() => { throw new Error('写入失败') }) as never)
      })
      const moved = path.join(project.folder, '事项', `2026-11-09_${eventId}`)
      const [record] = db.prepare('SELECT * FROM pending_operations').all() as Array<{ id: string; kind: string; payload: string }>
      expect(record.kind).toBe('move-event')

      w.manager.service.updateEvent(update)
      expect(pendingOperations(w.manager)).toEqual([])
      // A record that outlived its committed save, as an earlier build left it.
      db.prepare('INSERT INTO pending_operations VALUES (?, ?, ?)').run(record.id, record.kind, record.payload)

      const service = reopen(w)
      expect(pendingOperations(w.manager)).toEqual([])
      expect(fs.existsSync(moved)).toBe(true)
      expect(fs.existsSync(eventDir)).toBe(false)
      const saved = service.snapshot().projects[0].events[0]
      expect(saved.date).toBe('2026-11-09')
      expect(saved.items[0].attachments[0].exists).toBe(true)
    } finally { w.cleanup() }
  })
  it('keeps a renamed project folder across a restart when a stale record outlived the committed rename', () => {
    const w = workspace()
    try {
      const { projectId, project } = seedEvent(w.manager, w.root)
      const parent = path.dirname(project.folder), renamed = path.join(parent, '项目乙')
      w.manager.service.saveProject({ id: projectId, name: '项目乙', customer: '客户', contact: '', owner: '张三', note: '' })
      w.manager.service.db.prepare('INSERT INTO pending_operations VALUES (?, ?, ?)')
        .run('00000000-0000-4000-8000-000000000001', 'rename-project', JSON.stringify({ projectId, root: parent, from: project.folder, to: renamed }))
      const service = reopen(w)
      expect(pendingOperations(w.manager)).toEqual([])
      expect(fs.readdirSync(w.projects)).toEqual(['项目乙'])
      expect(service.snapshot().projects[0]).toMatchObject({ name: '项目乙', folderExists: true })
    } finally { w.cleanup() }
  })
  it('repairs attachment paths when the folder already carries the new date without a recovery record', () => {
    const w = workspace()
    try {
      const { projectId, eventId, eventDir, project } = seedEvent(w.manager, w.root)
      const moved = path.join(project.folder, '事项', `2026-11-09_${eventId}`)
      fs.renameSync(eventDir, moved)
      expect(w.manager.service.snapshot().projects[0].events[0].items[0].attachments[0].exists).toBe(false)
      w.manager.service.updateEvent({ id: eventId, projectId, name: '借用', owner: '张三', date: '2026-11-09' })
      const attachment = w.manager.service.snapshot().projects[0].events[0].items[0].attachments[0]
      expect(attachment.exists).toBe(true)
      expect(attachment.path.startsWith(path.join('事项', `2026-11-09_${eventId}`))).toBe(true)
    } finally { w.cleanup() }
  })
})

describe('#44 template move interrupted before the pointer is written', () => {
  function seedTemplates(w: ReturnType<typeof workspace>) {
    const service = w.manager.service
    for (const name of ['甲', '乙']) {
      service.saveLibraryFile({ name, purpose: '', categoryId: null })
      const template = service.snapshot().templates.find(t => t.name === name)!
      service.importLibraryFile(template.id, [file(w.root, `${name}.docx`, `${name}内容`)])
    }
    return service.snapshot().templates
  }
  async function interruptMove(w: ReturnType<typeof workspace>, target: string, message = '进程中断') {
    const write = vi.spyOn(w.manager as unknown as { write: () => void }, 'write').mockImplementation(() => { throw new Error('进程中断') })
    const remove = vi.spyOn(fs, 'rmSync').mockImplementation(() => { throw new Error('进程中断') })
    try { await expect(w.manager.change('template', target)).rejects.toThrow(message) }
    finally { write.mockRestore(); remove.mockRestore() }
  }
  it('retries the same destination by removing only its own copies', async () => {
    const w = workspace()
    try {
      const templates = seedTemplates(w)
      const target = path.join(w.root, 'nas-templates')
      fs.mkdirSync(target)
      await interruptMove(w, target)
      expect(w.manager.locations.template).toBe(fs.realpathSync(path.join(w.system, 'templates')))
      expect(fs.existsSync(path.join(target, templates[0].assets[0].path))).toBe(true)
      expect(fs.existsSync(path.join(target, '.workpack-templates.migrating'))).toBe(true)

      w.manager.close()
      w.manager = new StorageManager(w.system, w.projects)
      await w.manager.change('template', target)
      expect(w.manager.locations.template).toBe(fs.realpathSync(target))
      expect(fs.existsSync(path.join(target, '.workpack-templates.migrating'))).toBe(false)
      for (const template of w.manager.service.snapshot().templates) expect(template.assets[0].exists).toBe(true)
    } finally { w.cleanup() }
  })
  it('keeps a file the user put in place of a copy and reports the conflict', async () => {
    const w = workspace()
    try {
      const templates = seedTemplates(w)
      const target = path.join(w.root, 'nas-templates')
      fs.mkdirSync(target)
      await interruptMove(w, target)
      const own = path.join(target, templates[0].assets[0].path)
      fs.writeFileSync(own, '用户自己的文件')
      await expect(w.manager.change('template', target)).rejects.toThrow('已有同名文件')
      expect(fs.readFileSync(own, 'utf8')).toBe('用户自己的文件')
      expect(fs.existsSync(path.join(target, templates[1].assets[0].path))).toBe(false)
    } finally { w.cleanup() }
  })
  it('never records a file that was already in the destination, even one identical to the template', async () => {
    const w = workspace()
    try {
      const templates = seedTemplates(w)
      const target = path.join(w.root, 'nas-templates')
      const own = path.join(target, templates[1].assets[0].path)
      fs.mkdirSync(path.dirname(own), { recursive: true })
      fs.writeFileSync(own, '乙内容')
      const original = fs.statSync(own, { bigint: true }).ino
      await interruptMove(w, target, '已有同名文件')
      expect(fs.existsSync(path.join(target, '.workpack-templates.migrating'))).toBe(false)

      w.manager.close()
      w.manager = new StorageManager(w.system, w.projects)
      await expect(w.manager.change('template', target)).rejects.toThrow('已有同名文件')
      expect(fs.statSync(own, { bigint: true }).ino).toBe(original)
      expect(fs.readFileSync(own, 'utf8')).toBe('乙内容')
      expect(fs.existsSync(path.join(target, templates[0].assets[0].path))).toBe(false)
      expect(w.manager.locations.template).toBe(fs.realpathSync(path.join(w.system, 'templates')))
    } finally { w.cleanup() }
  })
  it('retries after the process stopped halfway through copying a file', async () => {
    const w = workspace()
    try {
      const templates = seedTemplates(w)
      const target = path.join(w.root, 'nas-templates')
      fs.mkdirSync(target)
      const finalNames = templates.map(t => path.join(target, t.assets[0].path))
      const copy = vi.spyOn(fs.promises, 'copyFile').mockImplementation(async (_source, destination) => {
        fs.writeFileSync(destination, '半')
        throw new Error('进程中断')
      })
      const remove = vi.spyOn(fs, 'rmSync').mockImplementation(() => { throw new Error('进程中断') })
      try { await expect(w.manager.change('template', target)).rejects.toThrow('进程中断') }
      finally { copy.mockRestore(); remove.mockRestore() }
      for (const name of finalNames) expect(fs.existsSync(name)).toBe(false)
      expect(fs.readdirSync(path.dirname(finalNames[0])).filter(name => name.endsWith('.tmp'))).toHaveLength(1)

      w.manager.close()
      w.manager = new StorageManager(w.system, w.projects)
      await w.manager.change('template', target)
      expect(w.manager.locations.template).toBe(fs.realpathSync(target))
      expect(finalNames.map(name => fs.readFileSync(name, 'utf8'))).toEqual(['甲内容', '乙内容'])
      for (const name of finalNames) expect(fs.readdirSync(path.dirname(name))).toEqual([path.basename(name)])
      expect(fs.existsSync(path.join(target, '.workpack-templates.migrating'))).toBe(false)
    } finally { w.cleanup() }
  })
  it('never overwrites a destination created by another writer during publication', async () => {
    const w = workspace()
    try {
      const templates = seedTemplates(w), target = path.join(w.root, 'destination')
      fs.mkdirSync(target)
      const userFile = path.join(target, templates[0].assets[0].path), link = fs.promises.link
      const publish = vi.spyOn(fs.promises, 'link').mockImplementation(async (from, to) => {
        if (String(to) === userFile) fs.writeFileSync(userFile, 'user file', { flag: 'wx' })
        return link(from, to)
      })
      try { await expect(w.manager.change('template', target)).rejects.toMatchObject({ code: 'EEXIST' }) }
      finally { publish.mockRestore() }
      expect(fs.readFileSync(userFile, 'utf8')).toBe('user file')
      expect(fs.readdirSync(path.dirname(userFile))).toEqual([path.basename(userFile)])
      expect(w.manager.locations.template).not.toBe(fs.realpathSync(target))
      expect(fs.existsSync(path.join(target, '.workpack-templates.migrating'))).toBe(false)
    } finally { w.cleanup() }
  })
  it('keeps an identical concurrent file across a crash before publication', async () => {
    const w = workspace()
    try {
      const templates = seedTemplates(w), target = path.join(w.root, 'destination')
      fs.mkdirSync(target)
      const userFile = path.join(target, templates[0].assets[0].path)
      const publish = vi.spyOn(fs.promises, 'link').mockImplementation(async () => {
        fs.writeFileSync(userFile, '甲内容', { flag: 'wx' })
        throw new Error('interrupted')
      })
      const remove = vi.spyOn(fs, 'rmSync').mockImplementation(() => { throw new Error('interrupted') })
      try { await expect(w.manager.change('template', target)).rejects.toThrow('interrupted') }
      finally { publish.mockRestore(); remove.mockRestore() }
      const identity = fs.statSync(userFile, { bigint: true }).ino
      reopen(w)
      await expect(w.manager.change('template', target)).rejects.toThrow('已有同名文件')
      expect(fs.statSync(userFile, { bigint: true }).ino).toBe(identity)
      expect(fs.readFileSync(userFile, 'utf8')).toBe('甲内容')
    } finally { w.cleanup() }
  })
  it('finishes staging cleanup after a committed migration is reopened', async () => {
    const w = workspace()
    try {
      const templates = seedTemplates(w), target = path.join(w.root, 'destination')
      fs.mkdirSync(target)
      const remove = fs.rmSync
      const failure = vi.spyOn(fs, 'rmSync').mockImplementation((file, options) => {
        if (String(file).endsWith('.tmp')) throw new Error('temporarily locked')
        return remove(file, options)
      })
      try { await w.manager.change('template', target) } finally { failure.mockRestore() }
      expect(fs.existsSync(path.join(target, '.workpack-templates.migrating'))).toBe(true)
      reopen(w)
      for (const t of templates) {
        const file = path.join(target, t.assets[0].path)
        expect(fs.readdirSync(path.dirname(file))).toEqual([path.basename(file)])
      }
      expect(fs.existsSync(path.join(target, '.workpack-templates.migrating'))).toBe(false)
    } finally { w.cleanup() }
  })
  async function unpublishedCopy(w: ReturnType<typeof workspace>) {
    const source = path.join(w.root, 'source-templates'), target = path.join(w.root, 'destination')
    fs.mkdirSync(source); fs.mkdirSync(target)
    await w.manager.change('template', source)
    seedTemplates(w)
    for (const name of ['甲.docx', '乙.docx']) fs.rmSync(path.join(w.root, name))
    const publish = vi.spyOn(fs.promises, 'link').mockRejectedValue(new Error('interrupted before publication'))
    const remove = vi.spyOn(fs, 'rmSync').mockImplementation(() => { throw new Error('interrupted') })
    try { await expect(w.manager.change('template', target)).rejects.toThrow('interrupted') }
    finally { publish.mockRestore(); remove.mockRestore() }
    const manifest = path.join(target, '.workpack-templates.migrating')
    const entries = (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { files: Array<{ path: string; staging: string }> }).files
    return { source, target, manifest, staging: path.join(target, entries[0].staging), final: path.join(target, entries[0].path) }
  }
  it('#58 refuses an offline switch to an unfinished destination and allows retry after the source returns', async () => {
    const w = workspace()
    try {
      const move = await unpublishedCopy(w), offline = `${move.source}-offline`
      w.manager.close(); fs.renameSync(move.source, offline)
      w.manager = new StorageManager(w.system, w.projects)
      const config = fs.readFileSync(w.manager.configPath, 'utf8')
      await expect(w.manager.change('template', move.target)).rejects.toThrow('未完成的模板迁移')
      expect(fs.readFileSync(w.manager.configPath, 'utf8')).toBe(config)
      expect(w.manager.locations.template).toBe(move.source)
      reopen(w)
      expect(fs.readFileSync(move.staging, 'utf8')).toBe('甲内容')
      expect(fs.existsSync(move.manifest)).toBe(true)
      fs.renameSync(offline, move.source)
      await w.manager.change('template', move.target)
      expect(fs.readFileSync(move.final, 'utf8')).toBe('甲内容')
      expect(fs.existsSync(move.staging)).toBe(false)
      expect(fs.existsSync(move.manifest)).toBe(false)
    } finally { w.cleanup() }
  })
  it.each(['missing', 'different file'])('#58 retains the only staging copy when an earlier version points at an unfinished directory: %s', async scenario => {
    const w = workspace()
    try {
      const move = await unpublishedCopy(w)
      w.manager.close()
      fs.rmSync(move.source, { recursive: true, force: true })
      if (scenario === 'different file') fs.writeFileSync(move.final, '甲内容')
      const config = JSON.parse(fs.readFileSync(path.join(w.system, 'storage.json'), 'utf8'))
      config.template = move.target
      fs.writeFileSync(path.join(w.system, 'storage.json'), JSON.stringify(config))
      w.manager = new StorageManager(w.system, w.projects)
      for (let n = 0; n < 2; n++) {
        expect(fs.readFileSync(move.staging, 'utf8')).toBe('甲内容')
        expect(fs.existsSync(move.manifest)).toBe(true)
        if (scenario === 'different file') expect(fs.readFileSync(move.final, 'utf8')).toBe('甲内容')
        else expect(fs.existsSync(move.final)).toBe(false)
        reopen(w)
      }
    } finally { w.cleanup() }
  })
  it('drops a manifest left in the folder the pointer already names', async () => {
    const w = workspace()
    try {
      seedTemplates(w)
      const target = path.join(w.root, 'nas-templates')
      fs.mkdirSync(target)
      await w.manager.change('template', target)
      fs.writeFileSync(path.join(target, '.workpack-templates.migrating'), JSON.stringify({ source: w.system, files: [] }))
      w.manager.close()
      w.manager = new StorageManager(w.system, w.projects)
      expect(fs.existsSync(path.join(target, '.workpack-templates.migrating'))).toBe(false)
    } finally { w.cleanup() }
  })
})

describe('#41 bounded-memory template verification', () => {
  it('hashes files larger than one chunk correctly', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-digest-'))
    try {
      for (const size of [0, 1, (1 << 20) - 1, 1 << 20, (3 << 20) + 17]) {
        const content = Buffer.alloc(size, size % 251)
        const target = path.join(root, `${size}.bin`)
        fs.writeFileSync(target, content)
        expect(await fileDigest(target)).toBe(createHash('sha256').update(content).digest('hex'))
      }
    } finally { fs.rmSync(root, { recursive: true, force: true }) }
  })
  it('keeps the main process responsive while a large template is copied and verified', async () => {
    const w = workspace()
    const copy = vi.spyOn(fs, 'copyFileSync'), read = vi.spyOn(fs, 'readSync')
    try {
      const service = w.manager.service
      service.saveLibraryFile({ name: '大文件', purpose: '', categoryId: null })
      const template = service.snapshot().templates[0]
      service.importLibraryFile(template.id, [file(w.root, '大文件.bin', 'x'.repeat((8 << 20) + 3))])
      service.saveLibraryFile({ name: '其他', purpose: '', categoryId: null })
      const empty = service.snapshot().templates.find(t => t.name === '其他')!
      const target = path.join(w.root, 'templates-next')
      fs.mkdirSync(target)
      copy.mockClear(); read.mockClear()
      let ticks = 0
      const timer = setInterval(() => { ticks++ }, 0)
      const moving = w.manager.change('template', target)
      try {
        await expect(w.manager.change('template', path.join(w.root, 'projects'))).rejects.toThrow('正在更改')
        expect(() => service.importLibraryFile(empty.id, [file(w.root, '其他.docx')])).toThrow('正在迁移')
        await moving
      } finally { clearInterval(timer) }
      expect(ticks).toBeGreaterThan(0)
      expect(copy).not.toHaveBeenCalled()
      expect(read).not.toHaveBeenCalled()
      expect(fs.statSync(path.join(target, template.id, '大文件.bin')).size).toBe((8 << 20) + 3)
      expect(w.manager.locations.template).toBe(fs.realpathSync(target))
      service.importLibraryFile(empty.id, [file(w.root, '其他.docx')])
      expect(fs.existsSync(path.join(target, empty.id, '其他.docx'))).toBe(true)
    } finally { copy.mockRestore(); read.mockRestore(); w.cleanup() }
  })
  it('moves a large template without reading it whole into memory', async () => {
    const w = workspace()
    const read = vi.spyOn(fs, 'readFileSync')
    try {
      const service = w.manager.service
      service.saveLibraryFile({ name: '大文件', purpose: '', categoryId: null })
      const template = service.snapshot().templates[0]
      service.importLibraryFile(template.id, [file(w.root, '大文件.bin', 'x'.repeat((2 << 20) + 5))])
      const target = path.join(w.root, 'templates-next')
      fs.mkdirSync(target)
      read.mockClear()
      await w.manager.change('template', target)
      expect(read.mock.calls.filter(([name]) => String(name).endsWith('大文件.bin'))).toEqual([])
      expect(fs.statSync(path.join(target, template.id, '大文件.bin')).size).toBe((2 << 20) + 5)
    } finally { read.mockRestore(); w.cleanup() }
  })
})

describe('#40 grouped snapshot assembly', () => {
  it('attaches every row to its own parent and keeps table and task order', () => {
    const w = workspace()
    try {
      const service = w.manager.service
      for (const name of ['甲模板', '乙模板']) service.saveLibraryFile({ name, purpose: `${name}用途`, categoryId: null })
      const [a, b] = service.snapshot().templates
      service.importLibraryFile(b.id, [file(w.root, '乙.docx')])
      const input = { customer: '客户', contact: '', owner: '张三', note: '' }
      const p1 = service.saveProject({ name: '项目一', ...input }), p2 = service.saveProject({ name: '项目二', ...input })
      const e1 = service.createLibraryEvent({ projectId: p1, templateIds: [a.id, b.id], name: '一号', date: '2026-11-01', owner: '张三' })
      const e2 = service.createLibraryEvent({ projectId: p2, templateIds: [b.id], name: '二号', date: '2026-11-02', owner: '李四' })
      const first = service.snapshot().projects.find(p => p.id === p1)!.events[0].items[0]
      for (const task of ['归档', '签字']) service.saveDocumentTask({ itemId: first.id, name: task })
      const snapshot = service.snapshot()
      expect(snapshot.templates.map(t => [t.name, t.purpose, t.assets.length])).toEqual([['甲模板', '甲模板用途', 0], ['乙模板', '乙模板用途', 1]])
      const one = snapshot.projects.find(p => p.id === p1)!, two = snapshot.projects.find(p => p.id === p2)!
      expect(one.events.map(e => e.id)).toEqual([e1])
      expect(two.events.map(e => e.id)).toEqual([e2])
      expect(one.events[0].templateIds).toEqual([a.id, b.id])
      expect(one.events[0].items.map(i => [i.name, i.attachments.length])).toEqual([['甲模板', 0], ['乙模板', 1]])
      expect(one.events[0].items[0].tasks.map(t => t.name)).toEqual(['准备文件', '归档', '签字'])
      expect(two.events[0].items.map(i => [i.name, i.attachments.length, i.tasks.length])).toEqual([['乙模板', 1, 1]])
    } finally { w.cleanup() }
  })
})

describe('#46 document_tasks lookups by item', () => {
  it('uses an index for cascading deletes and the next task position, including in an existing database', () => {
    const w = workspace()
    try {
      w.manager.service.db.exec('DROP INDEX document_tasks_item')
      w.manager.close()
      const reopened = new StorageManager(w.system, w.projects)
      try {
        const id = '00000000-0000-4000-8000-000000000000'
        expect(plan(reopened, 'DELETE FROM items WHERE id=?', id)).not.toMatch(/SCAN document_tasks/)
        expect(plan(reopened, 'SELECT COALESCE(MAX(position), -1) + 1 FROM document_tasks WHERE item_id=?', id)).toMatch(/document_tasks_item/)
      } finally { reopened.close() }
    } finally { fs.rmSync(w.root, { recursive: true, force: true }) }
  })
})

describe('#48 library lookups by template', () => {
  it('uses indexes for import, matter creation and template deletion, including in an existing database', () => {
    const w = workspace()
    try {
      w.manager.service.db.exec('DROP INDEX assets_template; DROP INDEX event_templates_template')
      w.manager.close()
      const reopened = new StorageManager(w.system, w.projects)
      try {
        const id = '00000000-0000-4000-8000-000000000000'
        expect(plan(reopened, 'SELECT 1 FROM event_templates WHERE template_id=? LIMIT 1', id)).toMatch(/event_templates_template/)
        expect(plan(reopened, 'SELECT 1 FROM assets WHERE template_id=? LIMIT 1', id)).toMatch(/assets_template/)
        expect(plan(reopened, 'SELECT * FROM assets WHERE template_id=? ORDER BY rowid LIMIT 1', id)).toMatch(/assets_template/)
        expect(plan(reopened, 'DELETE FROM templates WHERE id=?', id)).not.toMatch(/SCAN assets/)
      } finally { reopened.close() }
    } finally { fs.rmSync(w.root, { recursive: true, force: true }) }
  })
})

describe('#56 project rename that only changes letter case', () => {
  it('renames Alpha to ALPHA, still rejects a folder owned by something else, and rolls back on failure', () => {
    const w = workspace()
    try {
      const service = w.manager.service
      const input = { customer: '客户', contact: '', owner: '张三', note: '' }
      const id = service.saveProject({ name: 'Alpha', ...input })
      service.saveProject({ id, name: 'ALPHA', ...input })
      expect(fs.readdirSync(w.projects)).toEqual(['ALPHA'])
      expect(service.snapshot().projects[0]).toMatchObject({ name: 'ALPHA', folderExists: true })
      expect(path.basename(service.projectPath(id))).toBe('ALPHA')

      fs.mkdirSync(path.join(w.projects, 'Beta'))
      expect(() => service.saveProject({ id, name: 'Beta', ...input })).toThrow('目标目录已存在')
      service.saveProject({ id, name: 'Gamma', ...input })
      expect(fs.readdirSync(w.projects).sort()).toEqual(['Beta', 'Gamma'])

      const failing = vi.spyOn(service as unknown as { atomic: () => never }, 'atomic').mockImplementation(() => { throw new Error('写入失败') })
      try { expect(() => service.saveProject({ id, name: 'GAMMA', ...input })).toThrow('写入失败') }
      finally { failing.mockRestore() }
      expect(fs.readdirSync(w.projects).sort()).toEqual(['Beta', 'Gamma'])
      expect(service.snapshot().projects[0]).toMatchObject({ name: 'Gamma', folderExists: true })
    } finally { w.cleanup() }
  })
})

describe('#53 global search', () => {
  const event = (id: string, name: string, items: BusinessEvent['items'] = []): BusinessEvent => ({ id, projectId: 'p', templateId: '', templateIds: [], name, date: '2026-11-07', owner: '经办人', items })
  const project = (id: string, name: string, events: BusinessEvent[]): Project => ({ id, name, customer: '客户', contact: '', owner: '负责人', note: '', folder: '', folderExists: true, events })
  const withFile = event('e2', '发货', [{ id: 'i', eventId: 'e2', name: '装箱单', note: '', templateId: null, tasks: [], attachments: [{ id: 'a', itemId: 'i', name: '装箱-终版.xlsx', path: 'x', exists: true, createdAt: '' }] }])
  const projects = [project('p1', '项目甲', [event('e1', '测试事项'), withFile]), project('p2', '验收', [])]
  it('finds a matter that has no files left', () => {
    expect(findSearchTarget(projects, '测试事项')?.event?.id).toBe('e1')
  })
  it('finds matters by file and attachment names', () => {
    expect(findSearchTarget(projects, '装箱单')?.event?.id).toBe('e2')
    expect(findSearchTarget(projects, '终版')?.event?.id).toBe('e2')
  })
  it('prefers a project with the same name and reports no match', () => {
    const named = [...projects, project('p3', '测试事项', [])]
    expect(findSearchTarget(named, '测试事项')).toEqual({ project: named[2] })
    expect(findSearchTarget(projects, '不存在')).toBeNull()
    expect(findSearchTarget(projects, '  ')).toBeNull()
  })
})

describe('#45 default matter date', () => {
  it('uses the local calendar date around midnight and year boundaries', () => {
    expect(localDateInput(new Date(2026, 10, 7, 0, 30))).toBe('2026-11-07')
    expect(localDateInput(new Date(2026, 10, 7, 23, 59))).toBe('2026-11-07')
    expect(localDateInput(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01')
    expect(localDateInput(new Date(2026, 1, 28, 7, 59))).toBe('2026-02-28')
  })
  it('differs from the UTC date when local time is ahead of UTC', () => {
    const early = new Date(2026, 10, 7, 0, 30)
    if (early.getTimezoneOffset() < 0) expect(early.toISOString().slice(0, 10)).toBe('2026-11-06')
    expect(localDateInput(early)).toBe('2026-11-07')
  })
})

describe('#55 file names produced for duplicates', () => {
  it('keeps numbered names within the file name limit and keeps the extension', () => {
    expect(numberedFileName('报价.docx', 2)).toBe('报价 (2).docx')
    const longest = `${'a'.repeat(251)}.txt`
    expect(safeFileName(longest)).toBe(longest)
    expect(() => safeFileName(`a${longest}`)).toThrow('255')
    const numbered = numberedFileName(longest, 12)
    expect(numbered).toHaveLength(255)
    expect(numbered.endsWith(' (12).txt')).toBe(true)
    expect(numberedFileName(`${'名'.repeat(240)}. .pdf`, 1).length).toBeLessThanOrEqual(255)
    expect(() => safeFileName(numbered)).not.toThrow()
  })
  it('re-imports a 100-character file name and can still create matters and export from the numbered copy', () => {
    const w = workspace()
    try {
      const service = w.manager.service
      service.saveLibraryFile({ name: '长文件名', purpose: '', categoryId: null })
      const template = service.snapshot().templates[0]
      const source = file(w.root, `${'a'.repeat(96)}.txt`)
      service.importLibraryFile(template.id, [source])
      service.removeTemplateAsset(service.snapshot().templates[0].assets[0].id)
      service.importLibraryFile(template.id, [source])
      const asset = service.snapshot().templates[0].assets[0]
      expect(path.basename(asset.path)).toBe(`${'a'.repeat(96)} (1).txt`)
      const projectId = service.saveProject({ name: '项目甲', customer: '客户', contact: '', owner: '张三', note: '' })
      service.createLibraryEvent({ projectId, templateIds: [template.id], name: '借用', date: '2026-11-07', owner: '张三' })
      expect(service.snapshot().projects[0].events[0].items[0].attachments[0].exists).toBe(true)
      const exported = path.join(w.root, 'exported')
      fs.mkdirSync(exported)
      expect(service.exportTemplates([asset.id], exported)).toBe(1)
      expect(fs.readdirSync(exported)).toEqual([`${'a'.repeat(96)} (1).txt`])
    } finally { w.cleanup() }
  })
})

describe('#43 offline project and template locations', () => {
  it('starts with the database when configured folders are offline, creates nothing there, and can be pointed elsewhere', async () => {
    const w = workspace()
    const nas = path.join(w.root, 'nas'), drive = path.join(w.root, 'drive')
    for (const dir of [nas, drive]) fs.mkdirSync(dir)
    const service = w.manager.service
    service.saveLibraryFile({ name: '借用单', purpose: '', categoryId: null })
    const template = service.snapshot().templates[0]
    service.importLibraryFile(template.id, [file(w.root, '借用单.docx')])
    await w.manager.change('template', nas)
    await w.manager.change('project', drive)
    const projectId = w.manager.service.saveProject({ name: '项目甲', customer: '客户', contact: '', owner: '张三', note: '' })
    w.manager.close()
    const offlineNas = `${nas}-offline`
    fs.renameSync(nas, offlineNas)
    fs.renameSync(drive, `${drive}-offline`)
    const reopened = new StorageManager(w.system, w.projects)
    try {
      expect(fs.existsSync(nas)).toBe(false)
      expect(fs.existsSync(drive)).toBe(false)
      expect(reopened.locations.template).toBe(path.resolve(nas))
      expect(reopened.unavailable()).toEqual(['project', 'template'])
      const snapshot = reopened.service.snapshot()
      expect(snapshot.templates[0].assets[0].exists).toBe(false)
      expect(snapshot.projects.find(p => p.id === projectId)?.folderExists).toBe(false)
      expect(() => reopened.service.saveProject({ name: '项目乙', customer: '客户', contact: '', owner: '张三', note: '' })).toThrow('项目存储位置当前不可用')
      reopened.service.removeTemplateAsset(snapshot.templates[0].assets[0].id)
      expect(() => reopened.service.importLibraryFile(template.id, [file(w.root, '新借用单.docx')])).toThrow('模板存储位置当前不可用')
      const relocated = await reopened.change('template', offlineNas)
      expect(relocated.unavailable).toEqual(['project'])
      reopened.service.importLibraryFile(template.id, [file(w.root, '新借用单.docx')])
      expect(reopened.service.snapshot().templates[0].assets[0].exists).toBe(true)
    } finally { reopened.close(); fs.rmSync(w.root, { recursive: true, force: true }) }
  })
  it('starts when the default project folder cannot be reached or created', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-issues-'))
    const system = path.join(root, 'system'), documents = path.join(root, 'documents')
    // A file where the documents folder should be makes creating the default project folder fail, as an offline redirected folder does.
    fs.writeFileSync(documents, '')
    const projects = path.join(documents, 'WorkPack', '项目')
    const manager = new StorageManager(system, projects)
    try {
      expect(manager.locations.project).toBe(path.resolve(projects))
      expect(manager.unavailable()).toEqual(['project'])
      expect(() => manager.service.saveProject({ name: '项目甲', customer: '客户', contact: '', owner: '张三', note: '' })).toThrow('项目存储位置当前不可用')
      const other = path.join(root, 'other-projects')
      fs.mkdirSync(other)
      expect((await manager.change('project', other)).unavailable).toEqual([])
      expect(manager.service.saveProject({ name: '项目甲', customer: '客户', contact: '', owner: '张三', note: '' })).toBeTruthy()
    } finally { manager.close(); fs.rmSync(root, { recursive: true, force: true }) }
  })
})

describe('#49 storage locations nested in managed folders', () => {
  it('rejects storage locations inside a project folder', async () => {
    const w = workspace()
    try {
      const { eventDir, project } = seedEvent(w.manager, w.root)
      const nested = path.join(eventDir, 'templates')
      fs.mkdirSync(nested)
      for (const kind of ['template', 'workspace', 'project'] as const) {
        await expect(w.manager.change(kind, nested)).rejects.toThrow('项目文件夹')
        await expect(w.manager.change(kind, project.folder)).rejects.toThrow('项目文件夹')
      }
      expect(w.manager.locations.template).toBe(fs.realpathSync(path.join(w.system, 'templates')))
    } finally { w.cleanup() }
  })

  it('refuses to delete a matter whose folder contains a storage root and keeps every file', () => {
    const w = workspace()
    try {
      const { eventDir, eventId } = seedEvent(w.manager, w.root)
      const nested = path.join(eventDir, 'templates')
      fs.mkdirSync(nested)
      // A configuration written before the check existed can still point inside a matter.
      w.manager.service.templateRoot = nested
      expect(() => w.manager.service.deleteEvent(eventId)).toThrow('存储位置')
      expect(fs.existsSync(nested)).toBe(true)
      expect(w.manager.service.snapshot().projects[0].events).toHaveLength(1)
      w.manager.service.templateRoot = path.join(w.system, 'templates')
      w.manager.service.deleteEvent(eventId)
      expect(fs.existsSync(eventDir)).toBe(false)
    } finally { w.cleanup() }
  })
})
