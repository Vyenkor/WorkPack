import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { StorageManager, WorkspaceMissingError } from '../src/main/storage'

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-issues-'))
  const system = path.join(root, 'system'), projects = path.join(root, 'projects')
  fs.mkdirSync(projects)
  const manager = new StorageManager(system, projects)
  return { root, system, projects, manager, cleanup: () => { try { manager.close() } catch { /* Already closed by the test. */ } fs.rmSync(root, { recursive: true, force: true }) } }
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
  function moved() {
    const w = workspace()
    const custom = path.join(w.root, 'custom-workspace')
    fs.mkdirSync(custom)
    w.manager.change('workspace', custom)
    w.manager.service.saveLibraryFile({ name: '签收单', purpose: '', categoryId: null })
    w.manager.close()
    return { ...w, custom: fs.realpathSync(custom) }
  }
  it('creates the database on first launch only', () => {
    const w = workspace()
    try { expect(fs.existsSync(path.join(w.system, 'workpack-v3.sqlite'))).toBe(true) }
    finally { w.cleanup() }
  })
  it('refuses to start with an empty database when the folder was renamed, and can be pointed at the moved folder', () => {
    const w = moved()
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
  it('refuses to start when only the database file was moved away, and creates a new one only on request', () => {
    const w = moved()
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

describe('#49 storage locations nested in managed folders', () => {
  it('rejects storage locations inside a project folder', () => {
    const w = workspace()
    try {
      const { eventDir, project } = seedEvent(w.manager, w.root)
      const nested = path.join(eventDir, 'templates')
      fs.mkdirSync(nested)
      for (const kind of ['template', 'workspace', 'project'] as const) {
        expect(() => w.manager.change(kind, nested)).toThrow('项目文件夹')
        expect(() => w.manager.change(kind, project.folder)).toThrow('项目文件夹')
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
