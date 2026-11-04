import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { StorageManager } from '../src/main/storage'

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
      manager.change('template', templates)
      expect(fs.readFileSync(path.join(templates, file.id, '借用单.docx'))).toEqual(fs.readFileSync(originalTemplate))
      expect(fs.existsSync(originalTemplate)).toBe(true)
      manager.change('workspace', workspace)
      expect(manager.service.snapshot().templates[0].name).toBe('设备借用单')
      expect(manager.service.snapshot().projects[0].id).toBe(projectId)
      expect(fs.existsSync(path.join(system, 'workpack-v3.sqlite'))).toBe(true)
      expect(fs.existsSync(path.join(workspace, 'workpack-v3.sqlite'))).toBe(true)
      expect(() => manager.change('workspace', system)).toThrow('已有 WorkPack 数据库')
    } finally { manager.close() }
    const reopened = new StorageManager(system, projects)
    try { expect(reopened.locations).toEqual({ project: nextProjects, template: templates, workspace }) }
    finally { reopened.close(); fs.rmSync(root, { recursive: true, force: true }) }
  })
})
