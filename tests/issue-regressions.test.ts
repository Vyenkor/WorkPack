import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { StorageManager, WorkspaceMissingError } from '../src/main/storage'
import { numberedFileName, safeFileName } from '../src/main/service'
import { findSearchTarget, localDateInput, type BusinessEvent, type Project } from '../src/shared/model'

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
  it('starts with the database when configured folders are offline, creates nothing there, and can be pointed elsewhere', () => {
    const w = workspace()
    const nas = path.join(w.root, 'nas'), drive = path.join(w.root, 'drive')
    for (const dir of [nas, drive]) fs.mkdirSync(dir)
    const service = w.manager.service
    service.saveLibraryFile({ name: '借用单', purpose: '', categoryId: null })
    const template = service.snapshot().templates[0]
    service.importLibraryFile(template.id, [file(w.root, '借用单.docx')])
    w.manager.change('template', nas)
    w.manager.change('project', drive)
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
      const relocated = reopened.change('template', offlineNas)
      expect(relocated.unavailable).toEqual(['project'])
      reopened.service.importLibraryFile(template.id, [file(w.root, '新借用单.docx')])
      expect(reopened.service.snapshot().templates[0].assets[0].exists).toBe(true)
    } finally { reopened.close(); fs.rmSync(w.root, { recursive: true, force: true }) }
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
