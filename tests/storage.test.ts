import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { StorageManager } from '../src/main/storage'
import { WorkPackService } from '../src/main/service'

describe('storage settings', () => {
  it('creates projects under the selected root and copies templates and the live database before switching', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-storage-'))
    const system = path.join(root, 'system'), projects = path.join(root, 'projects')
    const nextProjects = path.join(root, 'next-projects'), templates = path.join(root, 'templates'), workspace = path.join(root, 'workspace')
    for (const dir of [projects, nextProjects, templates, workspace]) fs.mkdirSync(dir)
    const manager = new StorageManager(system, projects)
    try {
      manager.service.saveLibraryFile({ name: '设备借用单', purpose: '记录借用', categoryId: null })
      const file = manager.service.snapshot().templates[0]
      const source = path.join(root, '借用单.docx')
      fs.writeFileSync(source, 'template content')
      manager.service.importTemplates(file.id, [source])
      manager.change('project', nextProjects)
      const projectId = manager.service.saveProject({ name: '项目乙', customer: '客户', owner: '李四', contact: '', note: '', templateIds: [] })
      expect(manager.service.projectPath(projectId)).toBe(path.join(nextProjects, '项目乙'))
      const originalTemplate = path.join(system, 'templates', file.id, '借用单.docx')
      const collisionRoot = path.join(root, 'collision')
      fs.mkdirSync(path.join(collisionRoot, file.id), { recursive: true })
      fs.writeFileSync(path.join(collisionRoot, file.id, '借用单.docx'), 'other')
      expect(() => manager.change('template', collisionRoot)).toThrow('已有同名文件')
      expect(manager.locations.template).toBe(path.join(system, 'templates'))
      expect(fs.readFileSync(path.join(collisionRoot, file.id, '借用单.docx'), 'utf8')).toBe('other')
      manager.change('template', templates)
      expect(fs.readFileSync(path.join(templates, file.id, '借用单.docx'))).toEqual(fs.readFileSync(originalTemplate))
      expect(fs.existsSync(originalTemplate)).toBe(true)
      manager.change('workspace', workspace)
      expect(manager.service.snapshot().templates[0].name).toBe('设备借用单')
      expect(manager.service.snapshot().projects[0].id).toBe(projectId)
      expect(fs.existsSync(path.join(system, 'workpack-v3.sqlite'))).toBe(true)
      expect(fs.existsSync(path.join(workspace, 'workpack-v3.sqlite'))).toBe(true)
      expect(() => manager.change('workspace', system)).toThrow('迁回前请先把 workpack-v3.sqlite')
    } finally { manager.close() }
    const reopened = new StorageManager(system, projects)
    try { expect(reopened.locations).toEqual({ project: fs.realpathSync(nextProjects), template: fs.realpathSync(templates), workspace: fs.realpathSync(workspace) }) }
    finally { reopened.close(); fs.rmSync(root, { recursive: true, force: true }) }
  })

  it('rejects drive roots, system folders, and sync folders, and warns for project files in a sync folder', () => {
    const { root, manager } = temporary()
    try {
      expect(() => manager.change('project', path.parse(root).root)).toThrow('磁盘根目录')
      expect(() => manager.change('template', '/usr')).toThrow('系统目录')
      expect(() => manager.change('project', os.homedir())).toThrow('用户主目录')
      expect(() => manager.change('workspace', os.tmpdir())).toThrow('临时目录')
      const locked = path.join(root, 'locked')
      fs.mkdirSync(locked)
      fs.chmodSync(locked, 0o555)
      expect(() => manager.change('project', locked)).toThrow('没有写入权限')
      const synced = path.join(root, 'OneDrive', '工作空间')
      fs.mkdirSync(synced, { recursive: true })
      expect(() => manager.change('workspace', synced)).toThrow('OneDrive')
      expect(fs.existsSync(path.join(synced, 'workpack-v3.sqlite'))).toBe(false)
      const project = path.join(root, 'Dropbox', '项目')
      fs.mkdirSync(project, { recursive: true })
      const moved = manager.change('project', project)
      expect(moved.warning).toMatch(/Dropbox/)
      expect(moved.locations.project).toBe(fs.realpathSync(project))
      expect(manager.locations.workspace).toBe(fs.realpathSync(path.join(root, 'system')))
    } finally { cleanup(manager, root) }
  })

  it('replaces a crashed workspace copy, keeps an unrelated database, and canonicalizes the stored path', () => {
    const { root, system, manager } = temporary()
    const workspace = path.join(root, 'workspace')
    fs.mkdirSync(workspace)
    try {
      seed(manager)
      const marker = path.join(workspace, '.workpack-v3.sqlite.migrating')
      fs.writeFileSync(marker, JSON.stringify({ source: manager.locations.workspace }))
      fs.writeFileSync(path.join(workspace, 'workpack-v3.sqlite'), 'residue')
      fs.writeFileSync(path.join(workspace, 'workpack-v3.sqlite-wal'), 'wal')
      manager.change('workspace', workspace)
      expect(fs.existsSync(marker)).toBe(false)
      expect(fs.readFileSync(path.join(workspace, 'workpack-v3.sqlite')).equals(Buffer.from('residue'))).toBe(false)
      expect(manager.service.snapshot().templates[0].name).toBe('设备借用单')
      const committed = path.join(workspace, '.workpack-v3.sqlite.migrating')
      fs.writeFileSync(committed, JSON.stringify({ source: '/tmp/old-workspace' }))
      const kept = fs.readFileSync(path.join(workspace, 'workpack-v3.sqlite'))
      manager.close()
      const resumed = new StorageManager(system, path.join(root, 'projects'))
      try {
        expect(fs.existsSync(committed)).toBe(false)
        expect(fs.readFileSync(path.join(workspace, 'workpack-v3.sqlite'))).toEqual(kept)
        expect(resumed.service.snapshot().templates[0].name).toBe('设备借用单')
      } finally { resumed.close() }

      const foreignRoot = path.join(root, 'foreign')
      fs.mkdirSync(foreignRoot)
      fs.writeFileSync(path.join(foreignRoot, 'workpack-v3.sqlite'), 'foreign')
      fs.writeFileSync(path.join(foreignRoot, '.workpack-v3.sqlite.migrating'), JSON.stringify({ source: '/other/workspace' }))
      const again = new StorageManager(system, path.join(root, 'projects'))
      try {
        expect(() => again.change('workspace', foreignRoot)).toThrow('迁回前请先把 workpack-v3.sqlite')
        expect(fs.readFileSync(path.join(foreignRoot, 'workpack-v3.sqlite'), 'utf8')).toBe('foreign')
        expect(again.locations.workspace).toBe(fs.realpathSync(workspace))
      } finally { again.close() }
    } finally { fs.rmSync(root, { recursive: true, force: true }) }
  })

  it('loads a symlinked workspace path as its real directory and can move back after the old database is set aside', () => {
    const { root, system, manager } = temporary()
    const realWorkspace = path.join(root, 'real-workspace')
    const link = path.join(root, 'link-workspace')
    fs.mkdirSync(realWorkspace)
    fs.symlinkSync(realWorkspace, link)
    try {
      seed(manager)
      manager.change('workspace', link)
      expect(manager.locations.workspace).toBe(fs.realpathSync(realWorkspace))
      manager.close()
      const configPath = path.join(system, 'storage.json')
      const stored = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { workspace: string }
      stored.workspace = link
      fs.writeFileSync(configPath, JSON.stringify(stored))
      const reopened = new StorageManager(system, path.join(root, 'projects'))
      try {
        expect(reopened.locations.workspace).toBe(fs.realpathSync(realWorkspace))
        reopened.change('workspace', realWorkspace)
        expect(reopened.locations.workspace).toBe(fs.realpathSync(realWorkspace))
        expect(reopened.service.snapshot().templates[0].name).toBe('设备借用单')
        for (const name of ['workpack-v3.sqlite', 'workpack-v3.sqlite-wal', 'workpack-v3.sqlite-shm']) {
          const file = path.join(system, name)
          if (fs.existsSync(file)) fs.renameSync(file, `${file}.bak`)
        }
        reopened.change('workspace', system)
        expect(reopened.locations.workspace).toBe(fs.realpathSync(system))
        expect(reopened.service.snapshot().templates[0].name).toBe('设备借用单')
      } finally { reopened.close() }
    } finally { fs.rmSync(root, { recursive: true, force: true }) }
  })

  it('drops an unfinished workspace copy when closing the old database or writing the pointer fails', () => {
    const { root, system, manager } = temporary()
    const blocked = path.join(root, 'blocked')
    const retried = path.join(root, 'retried')
    fs.mkdirSync(blocked)
    fs.mkdirSync(retried)
    try {
      seed(manager)
      const originalClose = manager.service.close.bind(manager.service)
      const close = vi.spyOn(manager.service, 'close').mockImplementation(() => { throw new Error('关闭数据库失败') })
      try {
        expect(() => manager.change('workspace', blocked)).toThrow('关闭数据库失败')
        expect(manager.locations.workspace).toBe(fs.realpathSync(system))
        expect(fs.existsSync(path.join(system, 'storage.json'))).toBe(false)
        expect(workspaceResidue(blocked)).toEqual([])
        expect(manager.service.snapshot().templates[0].name).toBe('设备借用单')
      } finally { close.mockRestore() }

      const failingClose = vi.spyOn(manager.service, 'close').mockImplementation(() => { originalClose(); throw new Error('关闭数据库失败') })
      try {
        expect(() => manager.change('workspace', blocked)).toThrow('关闭数据库失败')
        expect(manager.locations.workspace).toBe(fs.realpathSync(system))
        expect(fs.existsSync(path.join(system, 'storage.json'))).toBe(false)
        expect(workspaceResidue(blocked)).toEqual([])
        expect(manager.service.snapshot().templates[0].name).toBe('设备借用单')
      } finally { failingClose.mockRestore() }

      fs.mkdirSync(manager.configPath)
      expect(() => manager.change('workspace', blocked)).toThrow()
      expect(manager.locations.workspace).toBe(fs.realpathSync(system))
      expect(fs.statSync(manager.configPath).isDirectory()).toBe(true)
      expect(workspaceResidue(blocked)).toEqual([])
      expect(manager.service.snapshot().templates[0].name).toBe('设备借用单')
      fs.rmSync(manager.configPath, { recursive: true, force: true })
      manager.change('workspace', retried)
      expect(manager.locations.workspace).toBe(fs.realpathSync(retried))
      expect(manager.service.snapshot().templates[0].name).toBe('设备借用单')
      expect(fs.existsSync(path.join(retried, '.workpack-v3.sqlite.migrating'))).toBe(false)
    } finally { cleanup(manager, root) }
  })

  it('removes a new database when checking it fails and rejects template files that escape through a symlink', () => {
    const { root, system, manager } = temporary()
    const workspace = path.join(root, 'workspace')
    const templates = path.join(root, 'templates')
    fs.mkdirSync(workspace)
    fs.mkdirSync(templates)
    const realWorkspace = fs.realpathSync(workspace)
    const original = WorkPackService.prototype.snapshot
    WorkPackService.prototype.snapshot = function (this: WorkPackService) {
      if (this.dataDirectory === realWorkspace) throw new Error('新库校验失败')
      return original.call(this)
    }
    try {
      seed(manager)
      expect(() => manager.change('workspace', workspace)).toThrow('新库校验失败')
      expect(manager.locations.workspace).toBe(fs.realpathSync(system))
      expect(workspaceResidue(workspace)).toEqual([])
      WorkPackService.prototype.snapshot = original
      expect(manager.service.snapshot().templates[0].name).toBe('设备借用单')
      const file = manager.service.snapshot().templates[0]
      const outside = path.join(root, 'outside.docx')
      fs.writeFileSync(outside, 'template content')
      manager.service.importTemplates(file.id, [outside])
      const stored = path.join(system, 'templates', file.id, 'outside.docx')
      fs.rmSync(stored)
      fs.symlinkSync(outside, stored)
      expect(() => manager.change('template', templates)).toThrow('符号链接')
      expect(manager.locations.template).toBe(fs.realpathSync(path.join(system, 'templates')))
      expect(fs.existsSync(path.join(templates, file.id, 'outside.docx'))).toBe(false)
    } finally {
      WorkPackService.prototype.snapshot = original
      cleanup(manager, root)
    }
  })
})

function temporary() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-storage-'))
  const system = path.join(root, 'system')
  const projects = path.join(root, 'projects')
  fs.mkdirSync(projects)
  return { root, system, projects, manager: new StorageManager(system, projects) }
}
function seed(manager: StorageManager) {
  manager.service.saveLibraryFile({ name: '设备借用单', purpose: '记录借用', categoryId: null })
}
function cleanup(manager: StorageManager, root: string) {
  try { manager.close() } catch { /* The assertion above already failed. */ }
  fs.rmSync(root, { recursive: true, force: true })
}
function workspaceResidue(directory: string) {
  return fs.readdirSync(directory).filter(name => name.includes('workpack-v3.sqlite'))
}
