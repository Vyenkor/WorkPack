import { describe, expect, it } from 'vitest'
import {
  itemMatchesGap,
  matchesCompletionFilter,
  matchesPendingQuery,
  type Attachment,
  type BusinessEvent,
  type Item,
  type PendingFilterQuery,
  type Project,
  type Status,
  type Step
} from '../src/shared/model'

const openQuery = (): PendingFilterQuery => ({ keyword: '', projectId: '', customer: '', templateId: '', owner: '', status: 'all', gap: 'all' })

function states(values: Partial<Record<Step, Status>> = {}): Record<Step, Status> {
  return { prepared: 'pending', filled: 'pending', signed: 'pending', archived: 'pending', ...values }
}

function attachment(exists: boolean): Attachment {
  return { id: 'file', itemId: 'item', name: 'file.pdf', path: 'file.pdf', createdAt: '2026-11-01', exists }
}

function sampleItem(partial: Partial<Item> = {}): Item {
  return {
    id: 'item',
    eventId: 'event',
    name: '发货清单',
    note: '',
    required: ['prepared', 'filled', 'signed', 'archived'],
    states: states(),
    attachments: [],
    ...partial
  }
}

function sample(partial: { project?: Partial<Project>; event?: Partial<BusinessEvent>; item?: Partial<Item> } = {}) {
  const item = sampleItem(partial.item)
  const event: BusinessEvent = {
    id: 'event',
    projectId: 'project',
    templateId: 'shipping',
    name: '第一批',
    date: '2026-11-01',
    owner: '经办甲',
    items: [item],
    ...partial.event
  }
  const project: Project = {
    id: 'project',
    name: '筛选甲',
    customer: '客户甲',
    contact: '',
    owner: '负责人甲',
    note: '',
    folder: '/tmp/project',
    templateIds: ['shipping'],
    folderExists: true,
    events: [event],
    ...partial.project
  }
  event.projectId = project.id
  item.eventId = event.id
  project.events = partial.project?.events ?? [event]
  return { project, event, item }
}

describe('pending filters', () => {
  it('keeps every gapped row when filters are cleared', () => {
    const row = sample()
    expect(matchesPendingQuery(row, openQuery(), '发货资料模板', 40)).toBe(true)
    expect(matchesPendingQuery(row, { ...openQuery(), keyword: '   ' }, '发货资料模板', 40)).toBe(true)
  })

  it('combines keyword, project, customer, workflow, owner, status, and gap with AND', () => {
    const row = sample()
    const query: PendingFilterQuery = { keyword: '清单', projectId: 'project', customer: '客户甲', templateId: 'shipping', owner: '经办甲', status: 'open', gap: 'unsigned' }
    expect(matchesPendingQuery(row, query, '发货资料模板', 40)).toBe(true)
    expect(matchesPendingQuery(row, { ...query, keyword: '不存在' }, '发货资料模板', 40)).toBe(false)
    expect(matchesPendingQuery(row, { ...query, projectId: 'other' }, '发货资料模板', 40)).toBe(false)
    expect(matchesPendingQuery(row, { ...query, customer: '客户乙' }, '发货资料模板', 40)).toBe(false)
    expect(matchesPendingQuery(row, { ...query, templateId: 'training' }, '发货资料模板', 40)).toBe(false)
    expect(matchesPendingQuery(row, { ...query, owner: '负责人甲' }, '发货资料模板', 40)).toBe(false)
    expect(matchesPendingQuery(row, { ...query, status: 'done' }, '发货资料模板', 40)).toBe(false)
    expect(matchesPendingQuery(row, { ...query, gap: 'unfilled' }, '发货资料模板', 40)).toBe(true)
    expect(matchesPendingQuery({ ...row, item: sampleItem({ states: states({ filled: 'done' }) }) }, { ...query, gap: 'unfilled' }, '发货资料模板', 40)).toBe(false)
  })

  it('matches keyword across project, customer, event, file, workflow, and the listed owner', () => {
    const row = sample()
    for (const keyword of ['筛选', '客户甲', '第一批', '发货清单', '发货资料', '经办甲', 'SHIP']) {
      const name = keyword === 'SHIP' ? 'Ship List' : row.item.name
      expect(matchesPendingQuery({ ...row, item: sampleItem({ name }) }, { ...openQuery(), keyword: keyword.toLowerCase() }, '发货资料模板', 40)).toBe(true)
    }
    expect(matchesPendingQuery(row, { ...openQuery(), keyword: '负责人甲' }, '发货资料模板', 40)).toBe(true)
    expect(matchesPendingQuery(row, { ...openQuery(), keyword: '流程已删除' }, '流程已删除', 40)).toBe(true)
  })

  it('filters completion status with the same open and done rule as projects', () => {
    expect(matchesCompletionFilter(100, true, 'done')).toBe(true)
    expect(matchesCompletionFilter(100, true, 'open')).toBe(false)
    expect(matchesCompletionFilter(99, true, 'open')).toBe(true)
    expect(matchesCompletionFilter(99, true, 'done')).toBe(false)
    expect(matchesCompletionFilter(0, false, 'done')).toBe(false)
    expect(matchesCompletionFilter(0, false, 'open')).toBe(true)
    expect(matchesCompletionFilter(100, false, 'done')).toBe(false)
    const row = sample()
    expect(matchesPendingQuery(row, { ...openQuery(), status: 'done' }, '', 100)).toBe(true)
    expect(matchesPendingQuery(row, { ...openQuery(), status: 'open' }, '', 100)).toBe(false)
    expect(matchesPendingQuery(row, { ...openQuery(), status: 'done' }, '', 100)).toBe(true)
    const emptyProject = sample({ project: { events: [] } })
    expect(matchesPendingQuery(emptyProject, { ...openQuery(), status: 'done' }, '', 100)).toBe(false)
    expect(matchesPendingQuery(emptyProject, { ...openQuery(), status: 'open' }, '', 100)).toBe(true)
  })

  it('locates unprepared, unfilled, unsigned, and unarchived gaps without treating 不适用 as missing', () => {
    const pending = sampleItem()
    expect(itemMatchesGap(pending, 'unprepared')).toBe(true)
    expect(itemMatchesGap(pending, 'unfilled')).toBe(true)
    expect(itemMatchesGap(pending, 'unsigned')).toBe(true)
    expect(itemMatchesGap(pending, 'unarchived')).toBe(true)

    const logistics = sampleItem({ states: states({ filled: 'na', signed: 'na' }) })
    expect(itemMatchesGap(logistics, 'unprepared')).toBe(true)
    expect(itemMatchesGap(logistics, 'unfilled')).toBe(false)
    expect(itemMatchesGap(logistics, 'unsigned')).toBe(false)
    expect(itemMatchesGap(logistics, 'unarchived')).toBe(true)

    const uploadedButUnsigned = sampleItem({
      states: states({ prepared: 'done', filled: 'done', archived: 'done' }),
      attachments: [attachment(true)]
    })
    expect(itemMatchesGap(uploadedButUnsigned, 'unprepared')).toBe(false)
    expect(itemMatchesGap(uploadedButUnsigned, 'unsigned')).toBe(true)

    const markedPreparedWithoutFile = sampleItem({
      states: states({ prepared: 'done', filled: 'done', signed: 'done', archived: 'done' }),
      attachments: [attachment(false)]
    })
    expect(itemMatchesGap(markedPreparedWithoutFile, 'unprepared')).toBe(true)
    expect(itemMatchesGap(markedPreparedWithoutFile, 'unfilled')).toBe(false)

    const notApplicable = sampleItem({ states: states({ prepared: 'na', filled: 'na', signed: 'na', archived: 'na' }) })
    expect(itemMatchesGap(notApplicable, 'unprepared')).toBe(false)
    expect(itemMatchesGap(notApplicable, 'unfilled')).toBe(false)
    expect(itemMatchesGap(notApplicable, 'unsigned')).toBe(false)
    expect(itemMatchesGap(notApplicable, 'unarchived')).toBe(false)
    expect(itemMatchesGap(notApplicable, 'all')).toBe(true)

    const brokenExtra = sampleItem({
      states: states({ prepared: 'done', filled: 'done', signed: 'done', archived: 'done' }),
      attachments: [attachment(true), { ...attachment(false), id: 'missing' }]
    })
    expect(itemMatchesGap(brokenExtra, 'unprepared')).toBe(false)
    expect(itemMatchesGap(brokenExtra, 'all')).toBe(true)
  })
})
