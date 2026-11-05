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

  it('releases a library file after its last matter item is removed and keeps the default task name fixed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-library-'))
    const data = path.join(root, 'data'), projects = path.join(root, 'projects')
    fs.mkdirSync(projects)
    let service = new WorkPackService(data, undefined, { projectRoot: projects })
    try {
      service.saveLibraryFile({ name: '发货清单', purpose: '核对货物' })
      service.saveLibraryFile({ name: '签收表', purpose: '确认收货' })
      const [fileA, fileB] = service.snapshot().templates
      const projectId = service.saveProject({ name: '项目甲', customer: '客户', contact: '', owner: '张三', note: '' })
      const eventId = service.createLibraryEvent({ projectId, templateIds: [fileA.id, fileB.id], name: '第一批发货', date: '2026-11-04', owner: '张三' })
      const otherEventId = service.createLibraryEvent({ projectId, templateIds: [fileA.id], name: '第二批发货', date: '2026-11-05', owner: '张三' })
      const created = service.snapshot().projects[0]
      const first = created.events.find(event => event.id === eventId)!
      expect(first.items.map(item => item.templateId)).toEqual([fileA.id, fileB.id])
      expect(() => service.deleteLibraryFile(fileA.id)).toThrow('文件已被事项使用，不能删除')
      service.db.exec('ALTER TABLE items DROP COLUMN template_id')
      service.close()
      service = new WorkPackService(data, undefined, { projectRoot: projects })
      const reopened = service.snapshot().projects[0]
      const event = reopened.events.find(item => item.id === eventId)!
      const other = reopened.events.find(item => item.id === otherEventId)!
      expect(event.items.map(item => item.templateId)).toEqual([fileA.id, fileB.id])
      const linked = event.items[0]
      const kept = event.items[1]
      service.saveItem({ id: linked.id, eventId, name: '改过的发货清单', note: '核对货物' })
      expect(() => service.saveDocumentTask({ id: kept.tasks[0].id, itemId: kept.id, name: '归档' })).toThrow('准备文件是默认待办，不能修改')
      service.saveDocumentTask({ itemId: kept.id, name: '签字' })
      const extra = service.snapshot().projects[0].events.find(item => item.id === eventId)!.items[1].tasks.find(task => task.name === '签字')!
      expect(() => service.saveDocumentTask({ id: extra.id, itemId: kept.id, name: '准备文件' })).toThrow('准备文件已自动加入清单')
      expect(() => service.deleteDocumentTask(kept.tasks[0].id)).toThrow('准备文件是默认待办')
      service.saveItem({ eventId, name: '补充说明', note: '' })
      const manual = service.snapshot().projects[0].events.find(item => item.id === eventId)!.items.find(item => item.name === '补充说明')!
      service.deleteItem(manual.id)
      expect(() => service.deleteLibraryFile(fileA.id)).toThrow('文件已被事项使用，不能删除')
      service.deleteItem(linked.id)
      expect(service.snapshot().projects[0].events.find(item => item.id === eventId)!.templateIds).toEqual([fileB.id])
      expect(service.snapshot().projects[0].events.find(item => item.id === eventId)!.templateId).toBe(fileB.id)
      expect(() => service.deleteLibraryFile(fileA.id)).toThrow('文件已被事项使用，不能删除')
      service.deleteItem(other.items[0].id)
      service.deleteLibraryFile(fileA.id)
      expect(service.snapshot().templates.map(file => file.id)).toEqual([fileB.id])
      expect(() => service.deleteLibraryFile(fileB.id)).toThrow('文件已被事项使用，不能删除')
      service.deleteItem(kept.id)
      service.deleteLibraryFile(fileB.id)
      expect(service.snapshot().templates).toEqual([])
    } finally { service.close(); fs.rmSync(root, { recursive: true, force: true }) }
  })
})

describe('legacy template reference cleanup', () => {
  it.each(['renamed item', 'renamed template', 'duplicate names', 'already upgraded'])(
    'releases unresolved references after deleting %s without releasing another matter', scenario => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-links-'))
      const projects = path.join(root, 'projects'), data = path.join(root, 'data')
      fs.mkdirSync(projects)
      let service = new WorkPackService(data, undefined, { projectRoot: projects })
      try {
        service.saveLibraryFile({ name: '发货单', purpose: '' })
        service.saveLibraryFile({ name: scenario === 'duplicate names' ? '发货单' : '签收单', purpose: '' })
        const files = service.snapshot().templates
        const projectId = service.saveProject({ name: '项目', customer: '客户', owner: '经办', contact: '', note: '' })
        const input = { projectId, templateIds: files.map(file => file.id), name: '发货', date: '2026-11-05', owner: '经办' }
        const eventId = service.createLibraryEvent(input)
        const first = service.snapshot().projects[0].events[0]
        if (scenario === 'renamed template') service.saveLibraryFile({ id: files[0].id, name: '新版发货单', purpose: '' })
        if (scenario === 'renamed item' || scenario === 'already upgraded') service.saveItem({ id: first.items[0].id, eventId, name: '第一批发货单', note: '' })
        service.db.exec('ALTER TABLE items DROP COLUMN template_id')
        service.close()
        service = new WorkPackService(data, undefined, { projectRoot: projects })
        if (scenario === 'already upgraded') {
          service.close()
          service = new WorkPackService(data, undefined, { projectRoot: projects })
        }
        expect(service.snapshot().projects[0].events[0].items[0].templateId).toBeNull()
        const otherId = service.createLibraryEvent({ ...input, name: '另一个事项', templateIds: [files[0].id] })
        expect(() => service.deleteLibraryFile(files[0].id)).toThrow('文件已被事项使用')
        service.deleteItem(first.items[0].id)
        if (scenario !== 'duplicate names') expect(service.snapshot().projects[0].events.find(event => event.id === eventId)!.templateIds).toEqual([files[1].id])
        expect(() => service.deleteLibraryFile(files[1].id)).toThrow('文件已被事项使用')
        service.deleteItem(first.items[1].id)
        const empty = service.snapshot().projects[0].events.find(event => event.id === eventId)!
        expect(empty.templateIds).toEqual([])
        expect(empty.templateId).toBe('')
        service.deleteLibraryFile(files[1].id)
        expect(() => service.deleteLibraryFile(files[0].id)).toThrow('文件已被事项使用')
        service.deleteItem(service.snapshot().projects[0].events.find(event => event.id === otherId)!.items[0].id)
        service.deleteLibraryFile(files[0].id)
      } finally { service.close(); fs.rmSync(root, { recursive: true, force: true }) }
    })

  it('repairs references already left behind in an empty matter on startup', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-links-'))
    const projects = path.join(root, 'projects'), data = path.join(root, 'data')
    fs.mkdirSync(projects)
    let service = new WorkPackService(data, undefined, { projectRoot: projects })
    try {
      service.saveLibraryFile({ name: '发货单', purpose: '' })
      const file = service.snapshot().templates[0]
      const projectId = service.saveProject({ name: '项目', customer: '客户', owner: '经办', contact: '', note: '' })
      service.createLibraryEvent({ projectId, templateIds: [file.id], name: '发货', date: '2026-11-05', owner: '经办' })
      service.db.exec('DELETE FROM items') // Reproduce residue left by the previous build.
      service.close()
      service = new WorkPackService(data, undefined, { projectRoot: projects })
      expect(service.snapshot().projects[0].events[0].templateIds).toEqual([])
      service.deleteLibraryFile(file.id)
      expect(service.snapshot().templates).toEqual([])
    } finally { service.close(); fs.rmSync(root, { recursive: true, force: true }) }
  })
})
