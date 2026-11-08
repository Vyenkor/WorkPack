import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { StorageManager } from '../src/main/storage'

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
