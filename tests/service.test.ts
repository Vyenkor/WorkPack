import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkPackService } from '../src/main/service'
import { steps } from '../src/shared/model'

const temporaryDirectories: string[] = []
function tempDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-test-'))
  temporaryDirectories.push(directory)
  return directory
}
function inputForProject(templateId: string) {
  return { name: '测试项目', customer: '测试客户', contact: '13800000000', owner: '测试负责人', note: '用于自动化验证', templateIds: [templateId] }
}

afterEach(() => {
  while (temporaryDirectories.length) {
    const directory = temporaryDirectories.pop()
    if (directory) fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('WorkPackService', () => {
  it('seeds templates, creates project folders, and snapshots event rules', () => {
    const root = tempDirectory()
    const data = path.join(root, 'data')
    const parent = path.join(root, 'projects')
    fs.mkdirSync(parent)
    const service = new WorkPackService(data)

    try {
      const template = service.snapshot().templates.find(item => item.type === 'shipping')!
      const source = path.join(root, '发货清单模板.docx')
      fs.writeFileSync(source, 'template')
      service.importTemplates(template.id, [source])
      service.saveProject(inputForProject(template.id), parent)

      let project = service.snapshot().projects[0]
      expect(project.folder).toBe(path.join(parent, '测试项目'))
      expect(project.folderExists).toBe(true)
      expect(fs.existsSync(path.join(project.folder, '模板文件', '发货', '发货清单模板.docx'))).toBe(true)

      service.createEvent({ projectId: project.id, templateId: template.id, name: '首批发货', date: '2026-09-23', owner: '测试负责人' })
      project = service.snapshot().projects[0]
      const event = project.events[0]
      expect(event.items.map(item => item.name)).toEqual(template.rules.map(rule => rule.name))

      const changedRules = template.rules.map((rule, index) => index === 0 ? { ...rule, name: '修改后的模板文件' } : rule)
      service.saveTemplate({ id: template.id, name: template.name, type: template.type, rules: changedRules })
      expect(service.snapshot().projects[0].events[0].items[0].name).not.toBe('修改后的模板文件')
    } finally { service.close() }
  })

  it('marks prepared files done on import and returns them to pending after removal', () => {
    const root = tempDirectory()
    const service = new WorkPackService(path.join(root, 'data'))
    try {
      const template = service.snapshot().templates.find(item => item.type === 'shipping')!
      const parent = path.join(root, 'projects')
      fs.mkdirSync(parent)
      service.saveProject(inputForProject(template.id), parent)
      let project = service.snapshot().projects[0]
      service.createEvent({ projectId: project.id, templateId: template.id, name: '附件测试', date: '2026-09-23', owner: '测试负责人' })
      project = service.snapshot().projects[0]
      const item = project.events[0].items[0]
      const attachment = path.join(root, '签收单.pdf')
      fs.writeFileSync(attachment, 'attachment')

      service.importAttachments(item.id, [attachment])
      let current = service.snapshot().projects[0].events[0].items[0]
      expect(current.states.prepared).toBe('done')
      expect(current.attachments).toHaveLength(1)
      expect(current.attachments[0].exists).toBe(true)

      service.removeAttachment(current.attachments[0].id)
      current = service.snapshot().projects[0].events[0].items[0]
      expect(current.states.prepared).toBe('pending')
      expect(current.attachments).toHaveLength(0)
    } finally { service.close() }
  })

  it('detects a moved project directory and can relocate it by its marker', () => {
    const root = tempDirectory()
    const service = new WorkPackService(path.join(root, 'data'))
    try {
      const template = service.snapshot().templates.find(item => item.type === 'training')!
      const parent = path.join(root, 'projects')
      const movedParent = path.join(root, 'moved')
      fs.mkdirSync(parent)
      fs.mkdirSync(movedParent)
      service.saveProject(inputForProject(template.id), parent)
      const original = service.snapshot().projects[0]
      const moved = path.join(movedParent, '测试项目')
      fs.renameSync(original.folder, moved)
      expect(service.snapshot().projects[0].folderExists).toBe(false)

      service.relocateProject(original.id, moved)
      expect(service.snapshot().projects[0].folderExists).toBe(true)
      expect(service.snapshot().projects[0].folder).toBe(moved)
    } finally { service.close() }
  })

  it('uses only applicable steps in item progress requirements', () => {
    const root = tempDirectory()
    const service = new WorkPackService(path.join(root, 'data'))
    try {
      const template = service.snapshot().templates[0]
      const parent = path.join(root, 'projects')
      fs.mkdirSync(parent)
      service.saveProject(inputForProject(template.id), parent)
      const project = service.snapshot().projects[0]
      service.createEvent({ projectId: project.id, templateId: template.id, name: '状态测试', date: '2026-09-23', owner: '测试负责人' })
      const item = service.snapshot().projects[0].events[0].items[0]
      service.setStatus({ id: item.id, step: 'signed', status: 'na' })
      const current = service.snapshot().projects[0].events[0].items[0]
      expect(current.required).toEqual(steps.filter(step => step !== 'signed'))
      expect(current.states.signed).toBe('na')
    } finally { service.close() }
  })
})
