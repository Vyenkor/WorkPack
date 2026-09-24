import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkPackService } from '../src/main/service'
import { progress, steps } from '../src/shared/model'

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
      expect(event.items[0].attachments).toHaveLength(1)
      expect(event.items[0].attachments[0].exists).toBe(true)
      expect(event.items[0].states.prepared).toBe('done')

      const changedRules = template.rules.map((rule, index) => index === 0 ? { ...rule, name: '修改后的模板文件' } : rule)
      service.saveTemplate({ id: template.id, name: template.name, type: template.type, rules: changedRules })
      expect(service.snapshot().projects[0].events[0].items[0].name).not.toBe('修改后的模板文件')
    } finally { service.close() }
  })

  it('supports user-defined workflow types and stores files under that type', () => {
    const root = tempDirectory()
    const service = new WorkPackService(path.join(root, 'data'))
    try {
      const base = service.snapshot().templates[0]
      const customName = '售后流程'
      service.saveTemplate({ name: customName, type: '售后', rules: [{ ...base.rules[0], name: '维修记录' }] })
      const custom = service.snapshot().templates.find(template => template.name === customName)!
      expect(custom.type).toBe('售后')
      const source = path.join(root, '维修记录模板.docx')
      fs.writeFileSync(source, 'template')
      service.importTemplates(custom.id, [source])

      const parent = path.join(root, 'projects')
      fs.mkdirSync(parent)
      service.saveProject(inputForProject(custom.id), parent)
      const project = service.snapshot().projects[0]
      service.createEvent({ projectId: project.id, templateId: custom.id, name: '售后事项', date: '2026-09-23', owner: '测试负责人' })

      expect(service.snapshot().projects[0].events[0].type).toBe('售后')
      expect(fs.existsSync(path.join(project.folder, '售后', '2026-09-23_' + service.snapshot().projects[0].events[0].id))).toBe(true)
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
      service.completeEvent(service.snapshot().projects[0].events[0].id)
      const completed = service.snapshot().projects[0].events[0].items[0]
      expect(completed.states.prepared).toBe('pending')
      expect(completed.states.filled).toBe('done')
      expect(progress([{ ...current, states: { prepared: 'done', filled: 'done', signed: 'done', archived: 'done' }, attachments: [] }]).percent).toBeLessThan(100)
    } finally { service.close() }
  })

  it('returns the saved project id so same-name projects stay distinguishable', () => {
    const root = tempDirectory()
    const service = new WorkPackService(path.join(root, 'data'))
    try {
      const template = service.snapshot().templates[0]
      const firstParent = path.join(root, 'first'), secondParent = path.join(root, 'second')
      fs.mkdirSync(firstParent)
      fs.mkdirSync(secondParent)
      const firstId = service.saveProject(inputForProject(template.id), firstParent)
      const secondId = service.saveProject(inputForProject(template.id), secondParent)

      expect(firstId).not.toBe(secondId)
      const projects = service.snapshot().projects
      expect(projects.find(project => project.id === firstId)!.folder).toBe(path.join(firstParent, '测试项目'))
      expect(projects.find(project => project.id === secondId)!.folder).toBe(path.join(secondParent, '测试项目'))

      const edited = service.saveProject({ ...inputForProject(template.id), id: secondId, name: '重命名项目' })
      expect(edited).toBe(secondId)
      expect(service.snapshot().projects.find(project => project.id === secondId)!.folder).toBe(path.join(secondParent, '重命名项目'))
    } finally { service.close() }
  })

  it('rejects marking a file prepared until it has an available attachment', () => {
    const root = tempDirectory()
    const service = new WorkPackService(path.join(root, 'data'))
    try {
      const template = service.snapshot().templates[0]
      const parent = path.join(root, 'projects')
      fs.mkdirSync(parent)
      service.saveProject(inputForProject(template.id), parent)
      const project = service.snapshot().projects[0]
      service.createEvent({ projectId: project.id, templateId: template.id, name: '准备状态测试', date: '2026-09-23', owner: '测试负责人' })
      const item = service.snapshot().projects[0].events[0].items[0]

      expect(() => service.setStatus({ id: item.id, step: 'prepared', status: 'done' })).toThrow('请先上传文件')
      expect(service.snapshot().projects[0].events[0].items[0].states.prepared).toBe('pending')

      const attachment = path.join(root, '发货清单.pdf')
      fs.writeFileSync(attachment, 'attachment')
      service.importAttachments(item.id, [attachment])
      const uploaded = service.snapshot().projects[0].events[0].items[0]
      service.setStatus({ id: item.id, step: 'prepared', status: 'pending' })
      service.setStatus({ id: item.id, step: 'prepared', status: 'done' })
      expect(service.snapshot().projects[0].events[0].items[0].states.prepared).toBe('done')

      fs.unlinkSync(path.join(project.folder, uploaded.attachments[0].path))
      expect(service.snapshot().projects[0].events[0].items[0].states.prepared).toBe('pending')
      expect(() => service.setStatus({ id: item.id, step: 'prepared', status: 'done' })).toThrow('请先上传文件')
    } finally { service.close() }
  })

  it('updates event details and moves generated work copies with the date', () => {
    const root = tempDirectory()
    const service = new WorkPackService(path.join(root, 'data'))
    try {
      const template = service.snapshot().templates.find(item => item.type === 'shipping')!
      const source = path.join(root, '客户签收单模板.docx')
      fs.writeFileSync(source, 'template')
      service.importTemplates(template.id, [source])
      const parent = path.join(root, 'projects')
      fs.mkdirSync(parent)
      service.saveProject(inputForProject(template.id), parent)
      const project = service.snapshot().projects[0]
      const eventId = service.createEvent({ projectId: project.id, templateId: template.id, name: '待修改事项', date: '2026-09-23', owner: '测试负责人' })
      const event = service.snapshot().projects[0].events[0]
      expect(event.items.some(item => item.attachments.length)).toBe(true)

      service.updateEvent({ id: eventId, projectId: project.id, templateId: template.id, name: '已修改事项', date: '2026-09-24', owner: '新经办人' })
      let current = service.snapshot().projects[0].events[0]
      expect(current.name).toBe('已修改事项')
      expect(current.date).toBe('2026-09-24')
      expect(current.owner).toBe('新经办人')
      const attachmentItem = current.items.find(item => item.attachments.length)!
      expect(attachmentItem.attachments[0].path).toContain('2026-09-24_')
      expect(attachmentItem.attachments[0].exists).toBe(true)

      service.deleteEvent(eventId)
      expect(service.snapshot().projects[0].events).toHaveLength(0)
    } finally { service.close() }
  })

  it('deletes project records while preserving the project folder and files', () => {
    const root = tempDirectory()
    const service = new WorkPackService(path.join(root, 'data'))
    try {
      const template = service.snapshot().templates[0]
      const parent = path.join(root, 'projects')
      fs.mkdirSync(parent)
      service.saveProject(inputForProject(template.id), parent)
      const project = service.snapshot().projects[0]
      const marker = path.join(project.folder, '现场资料.txt')
      fs.writeFileSync(marker, 'keep')
      service.createEvent({ projectId: project.id, templateId: template.id, name: '待删除事项', date: '2026-09-23', owner: '测试负责人' })

      service.deleteProject(project.id)

      expect(service.snapshot().projects).toHaveLength(0)
      expect(fs.existsSync(project.folder)).toBe(true)
      expect(fs.readFileSync(marker, 'utf8')).toBe('keep')
    } finally { service.close() }
  })
})
