import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { WorkPackService, safeName } from '../src/main/service'

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workpack-service-'))
  const projects = path.join(root, 'projects')
  fs.mkdirSync(projects)
  const service = new WorkPackService(path.join(root, 'data'), undefined, { projectRoot: projects })
  return { root, projects, service, close: () => { service.close(); fs.rmSync(root, { recursive: true, force: true }) } }
}

describe('current service and disk boundaries', () => {
  it('starts with an empty library and preserves the retired database file', () => {
    const f = fixture()
    try {
      const old = path.join(f.root, 'data', 'workpack.sqlite')
      fs.writeFileSync(old, 'old workspace')
      expect(f.service.snapshot().templates).toEqual([])
      expect(fs.readFileSync(old, 'utf8')).toBe('old workspace')
      expect(fs.existsSync(path.join(f.root, 'data', 'workpack-v3.sqlite'))).toBe(true)
    } finally { f.close() }
  })
  it('rejects reserved names and cannot mark preparation done without a file', () => {
    const f = fixture()
    try {
      expect(() => safeName('CON')).toThrow()
      expect(() => safeName('../outside')).toThrow()
      f.service.saveLibraryFile({ name: '借用单', purpose: '', categoryId: null })
      const template = f.service.snapshot().templates[0]
      const project = f.service.saveProject({ name: '安全项目', customer: '客户', contact: '', owner: '经办', note: '' })
      f.service.createLibraryEvent({ projectId: project, templateIds: [template.id], name: '借用设备', date: '2026-11-04', owner: '经办' })
      const item = f.service.snapshot().projects[0].events[0].items[0]
      expect(() => f.service.setDocumentTaskDone({ id: item.tasks[0].id, done: true })).toThrow('请先添加文件')
      expect(() => f.service.deleteDocumentTask(item.tasks[0].id)).toThrow('默认待办')
      const source = path.join(f.root, '借用单.docx')
      fs.writeFileSync(source, 'content')
      f.service.importAttachments(item.id, [source])
      f.service.setDocumentTaskDone({ id: item.tasks[0].id, done: true })
      expect(f.service.snapshot().projects[0].events[0].items[0].tasks[0].done).toBe(true)
      const attachment = f.service.snapshot().projects[0].events[0].items[0].attachments[0]
      f.service.removeAttachment(attachment.id)
      expect(f.service.snapshot().projects[0].events[0].items[0].tasks[0].done).toBe(false)
    } finally { f.close() }
  })
  it('backs up WAL changes and rejects live database overwrites', () => {
    const f = fixture()
    try {
      f.service.saveLibraryFile({ name: '签收表', purpose: '确认收货', categoryId: null })
      const backup = path.join(f.root, 'backup.sqlite')
      expect(() => f.service.backupDatabase(f.service.db.name)).toThrow('不能覆盖')
      f.service.backupDatabase(backup)
      expect(fs.statSync(backup).size).toBeGreaterThan(0)
      const image = new Database(backup, { readonly: true })
      try { expect((image.prepare('SELECT name FROM templates').get() as { name: string }).name).toBe('签收表') }
      finally { image.close() }
    } finally { f.close() }
  })
  it('never exports an asset path that escapes the template directory', () => {
    const f = fixture()
    try {
      f.service.saveLibraryFile({ name: '发货单', purpose: '', categoryId: null })
      const template = f.service.snapshot().templates[0]
      fs.writeFileSync(path.join(f.root, 'outside.txt'), 'private content')
      f.service.db.prepare('INSERT INTO assets VALUES (?, ?, ?, ?)').run('d69dc626-b91b-4bc7-95d8-fbe39674ebca', template.id, 'outside.txt', '../outside.txt')
      expect(f.service.snapshot().templates[0].assets[0].exists).toBe(false)
      expect(() => f.service.exportTemplates(['d69dc626-b91b-4bc7-95d8-fbe39674ebca'], f.root)).toThrow('超出项目目录')
      expect(fs.readFileSync(path.join(f.root, 'outside.txt'), 'utf8')).toBe('private content')
    } finally { f.close() }
  })
})
