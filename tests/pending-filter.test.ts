import { describe, expect, it } from 'vitest'
import { defaultPendingFilter, gaps, groupPendingRows, matchesCompletionFilter, matchesPendingQuery, normalizePendingViewState, parsePendingViewState, progress, type Item, type Project } from '../src/shared/model'

const item = (done = false, exists = false): Item => ({ id: 'item', eventId: 'event', name: '发货清单', note: '', templateId: null, attachments: exists ? [{ id: 'attachment', itemId: 'item', name: '清单.docx', path: 'a', exists, createdAt: '' }] : [], tasks: [{ id: 'task', itemId: 'item', name: '准备文件', done, position: 0 }] })
const project = (): Project => ({ id: 'project', name: '项目甲', customer: '客户甲', contact: '', owner: '负责人', note: '', folder: '/tmp/project', folderExists: true, events: [{ id: 'event', projectId: 'project', templateId: '', templateIds: [], name: '第一批', date: '2026-11-04', owner: '经办甲', items: [item()] }] })

describe('current pending view', () => {
  it('defaults to unfinished files and preserves explicitly saved status choices', () => {
    const p = project(), event = p.events[0]
    const rows = [item(), item(true, true)].map(item => ({ project: p, event, item }))
    expect(rows.filter(row => matchesPendingQuery(row, defaultPendingFilter()))).toEqual([rows[0]])
    for (const raw of [null, '{}', 'invalid json', { filter: { status: 'invalid' } }]) {
      expect(parsePendingViewState(raw).filter.status).toBe('open')
    }
    for (const status of ['all', 'open', 'done'] as const) {
      expect(parsePendingViewState({ filter: { status }, groupBy: 'owner' })).toMatchObject({ filter: { status }, groupBy: 'owner' })
    }
  })
  it('keeps project completion filtering separate from file gaps', () => {
    for (const [percent, hasWork, complete] of [[0, false, false], [0, true, false], [50, true, false], [100, true, true], [100, false, false]] as const) {
      expect(matchesCompletionFilter(percent, hasWork, 'all')).toBe(true)
      expect(matchesCompletionFilter(percent, hasWork, 'done')).toBe(complete)
      expect(matchesCompletionFilter(percent, hasWork, 'open')).toBe(!complete)
    }
  })
  it('counts only active custom tasks and requires a usable file for preparation', () => {
    expect(progress([item(true, false)]).percent).toBe(0)
    expect(progress([item(true, true)]).percent).toBe(100)
    expect(gaps(item(true, false))).toEqual(['待准备文件'])
    expect(gaps(item(true, true))).toEqual([])
    const custom = item(true, true)
    custom.tasks.push({ id: 'custom', itemId: custom.id, name: '归档', done: false, position: 1 })
    expect(progress([custom]).percent).toBe(50)
    expect(gaps(custom)).toEqual(['待归档'])
  })
  it('filters by current fields and groups by project or owner', () => {
    const p = project(), row = { project: p, event: p.events[0], item: p.events[0].items[0] }
    expect(matchesPendingQuery(row, { ...defaultPendingFilter(), keyword: '发货', customer: '客户甲', owner: '经办甲', status: 'open' })).toBe(true)
    expect(matchesPendingQuery(row, { ...defaultPendingFilter(), keyword: '不存在' })).toBe(false)
    expect(matchesPendingQuery(row, { ...defaultPendingFilter(), status: 'done' })).toBe(false)
    expect(groupPendingRows([row], 'project')[0].label).toBe('项目甲')
    expect(groupPendingRows([row], 'owner')[0].label).toBe('经办甲')

  })
  it('filters each file independently of project progress and treats missing attachments as open', () => {
    const p = project(), event = p.events[0]
    const completed = item(true, true)
    const row = { project: p, event, item: completed }
    expect(matchesPendingQuery(row, { ...defaultPendingFilter(), status: 'done' })).toBe(true)
    expect(matchesPendingQuery(row, { ...defaultPendingFilter(), status: 'open' })).toBe(false)
    completed.attachments.push({ ...completed.attachments[0], id: 'missing', exists: false })
    expect(matchesPendingQuery(row, { ...defaultPendingFilter(), status: 'done' })).toBe(false)
    expect(matchesPendingQuery(row, { ...defaultPendingFilter(), status: 'open' })).toBe(true)
    expect(matchesPendingQuery(row, defaultPendingFilter())).toBe(true)
    completed.attachments = []
    expect(matchesPendingQuery(row, { ...defaultPendingFilter(), status: 'done' })).toBe(false)
    const noTasks = { ...completed, tasks: [] }
    expect(matchesPendingQuery({ ...row, item: noTasks }, { ...defaultPendingFilter(), status: 'done' })).toBe(true)
  })
  it('drops removed project filters and retired filter keys from saved preferences', () => {
    const old = JSON.stringify({ filter: { ...defaultPendingFilter(), projectId: 'missing', templateId: 'old', gap: 'unsigned' }, groupBy: 'owner' })
    const parsed = parsePendingViewState(old)
    expect(parsed.filter).not.toHaveProperty('templateId')
    expect(parsed.filter).not.toHaveProperty('gap')
    expect(normalizePendingViewState(parsed, { projectIds: [] }).filter.projectId).toBe('')
  })
})
