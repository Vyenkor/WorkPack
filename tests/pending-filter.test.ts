import { describe, expect, it } from 'vitest'
import { cachedProjectPercent, defaultPendingFilter, gaps, groupPendingRows, matchesPendingQuery, normalizePendingViewState, parsePendingViewState, progress, type Item, type Project } from '../src/shared/model'

const item = (done = false, exists = false): Item => ({ id: 'item', eventId: 'event', name: '发货清单', note: '', templateId: null, attachments: exists ? [{ id: 'attachment', itemId: 'item', name: '清单.docx', path: 'a', exists, createdAt: '' }] : [], tasks: [{ id: 'task', itemId: 'item', name: '准备文件', done, position: 0 }] })
const project = (): Project => ({ id: 'project', name: '项目甲', customer: '客户甲', contact: '', owner: '负责人', note: '', folder: '/tmp/project', folderExists: true, events: [{ id: 'event', projectId: 'project', templateId: '', templateIds: [], name: '第一批', date: '2026-11-04', owner: '经办甲', items: [item()] }] })

describe('current pending view', () => {
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
    expect(matchesPendingQuery(row, { ...defaultPendingFilter(), keyword: '发货', customer: '客户甲', owner: '经办甲', status: 'open' }, 0)).toBe(true)
    expect(matchesPendingQuery(row, { ...defaultPendingFilter(), keyword: '不存在' }, 0)).toBe(false)
    expect(matchesPendingQuery(row, { ...defaultPendingFilter(), status: 'done' }, 0)).toBe(false)
    expect(groupPendingRows([row], 'project')[0].label).toBe('项目甲')
    expect(groupPendingRows([row], 'owner')[0].label).toBe('经办甲')
    const cache = new Map<string, number>()
    expect(cachedProjectPercent(p.id, cache, () => 20)).toBe(20)
    expect(cachedProjectPercent(p.id, cache, () => 80)).toBe(20)
  })
  it('drops removed project filters and retired filter keys from saved preferences', () => {
    const old = JSON.stringify({ filter: { ...defaultPendingFilter(), projectId: 'missing', templateId: 'old', gap: 'unsigned' }, groupBy: 'owner' })
    const parsed = parsePendingViewState(old)
    expect(parsed.filter).not.toHaveProperty('templateId')
    expect(parsed.filter).not.toHaveProperty('gap')
    expect(normalizePendingViewState(parsed, { projectIds: [] }).filter.projectId).toBe('')
  })
})
