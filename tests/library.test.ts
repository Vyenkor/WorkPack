import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { WorkPackService } from '../src/main/service'
import { gaps, progress } from '../src/shared/model'

describe('file library and event checklists', () => {
  it('starts empty without touching the previous database, copies selected files, and keeps each checklist independent', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-library-'))
    const data = path.join(root, 'data'), projects = path.join(root, 'projects')
    fs.mkdirSync(projects)
    fs.mkdirSync(data)
    fs.writeFileSync(path.join(data, 'workpack.sqlite'), 'old business data')
    const oldBytes = fs.readFileSync(path.join(data, 'workpack.sqlite'))
    const service = new WorkPackService(data, undefined, { projectRoot: projects })
    try {
      expect(service.snapshot().templates).toEqual([])
      service.saveLibraryCategory({ name: '发货前准备' })
      const category = service.snapshot().categories![0]
      service.saveLibraryFile({ name: '发货清单', purpose: '核对货物', categoryId: category.id })
      service.saveLibraryFile({ name: '签收表', purpose: '确认收货', categoryId: category.id })
      const files = service.snapshot().templates
      expect(files.map(file => file.purpose)).toEqual(['核对货物', '确认收货'])
      const source = path.join(root, '发货清单.docx')
      fs.writeFileSync(source, 'template')
      service.importLibraryFile(files[0].id, [source])
      const projectId = service.saveProject({ name: '项目甲', customer: '客户', contact: '', owner: '张三', note: '', })
      const eventId = service.createLibraryEvent({ projectId, templateIds: files.map(file => file.id), name: '第一批发货', date: '2026-11-04', owner: '张三' })
      const event = service.snapshot().projects[0].events[0]
      expect(event.id).toBe(eventId)
      expect(event.items.map(item => item.name)).toEqual(['发货清单', '签收表'])
      expect(event.items[0].attachments[0].exists).toBe(true)
      expect(event.items[0].tasks?.map(task => task.name)).toEqual(['准备文件'])
      expect(() => service.setDocumentTaskDone({ id: event.items[1].tasks![0].id, done: true })).toThrow('请先添加文件')
      service.setDocumentTaskDone({ id: event.items[0].tasks![0].id, done: true })
      service.saveDocumentTask({ itemId: event.items[0].id, name: '签字' })
      const updated = service.snapshot().projects[0].events[0]
      expect(updated.items[0].tasks).toHaveLength(2)
      expect(updated.items[1].tasks).toHaveLength(1)
      expect(gaps(updated.items[0])).toContain('待签字')
      expect(progress(updated.items).percent).toBe(33)
      fs.unlinkSync(path.join(service.snapshot().projects[0].folder, updated.items[0].attachments[0].path))
      expect(service.snapshot().projects[0].events[0].items[0].tasks![0].done).toBe(false)
      expect(progress(service.snapshot().projects[0].events[0].items).percent).toBe(0)
      service.deleteLibraryCategory(category.id)
      expect(service.snapshot().templates[0].categoryId).toBeNull()
      expect(fs.readFileSync(path.join(data, 'workpack.sqlite'))).toEqual(oldBytes)
    } finally { service.close(); fs.rmSync(root, { recursive: true, force: true }) }
  })
})
