import { describe, expect, it } from 'vitest'
import {
  cachedProjectPercent,
  defaultPendingViewState,
  gaps,
  groupPendingRows,
  itemMatchesGap,
  matchesCompletionFilter,
  matchesPendingQuery,
  PENDING_VIEW_STORAGE_KEY,
  parsePendingViewState,
  readPendingViewState,
  serializePendingViewState,
  writePendingViewState,
  type Attachment,
  type BusinessEvent,
  type Item,
  type PendingFilterQuery,
  type PendingGroupBy,
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

  it('trims customer and owner on both the query and the row', () => {
    const row = sample({ project: { customer: ' 客户甲 ' }, event: { owner: ' 经办甲 ' } })
    expect(matchesPendingQuery(row, { ...openQuery(), customer: '客户甲' }, '', 40)).toBe(true)
    expect(matchesPendingQuery(row, { ...openQuery(), customer: ' 客户甲 ' }, '', 40)).toBe(true)
    expect(matchesPendingQuery(row, { ...openQuery(), owner: '经办甲' }, '', 40)).toBe(true)
    expect(matchesPendingQuery(row, { ...openQuery(), owner: ' 经办甲 ' }, '', 40)).toBe(true)
    expect(matchesPendingQuery(row, { ...openQuery(), customer: '   ' }, '', 40)).toBe(true)
    expect(matchesPendingQuery(row, { ...openQuery(), owner: '   ' }, '', 40)).toBe(true)
    expect(matchesPendingQuery(row, { ...openQuery(), customer: '客户乙' }, '', 40)).toBe(false)
    expect(matchesPendingQuery(row, { ...openQuery(), owner: '经办乙' }, '', 40)).toBe(false)
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

  it('skips project progress unless completion status is filtered, and caches it per project', () => {
    const row = sample()
    let calls = 0
    const percent = () => { calls += 1; return 40 }
    expect(matchesPendingQuery(row, openQuery(), '', percent)).toBe(true)
    expect(calls).toBe(0)
    expect(matchesPendingQuery(row, { ...openQuery(), projectId: 'other', status: 'open' }, '', percent)).toBe(false)
    expect(calls).toBe(0)
    expect(matchesPendingQuery(row, { ...openQuery(), status: 'open' }, '', percent)).toBe(true)
    expect(calls).toBe(1)

    const cache = new Map<string, number>()
    let computes = 0
    const compute = () => { computes += 1; return 15 }
    expect(cachedProjectPercent('project', cache, compute)).toBe(15)
    expect(cachedProjectPercent('project', cache, compute)).toBe(15)
    expect(cachedProjectPercent('other', cache, compute)).toBe(15)
    expect(computes).toBe(2)
    expect(cachedProjectPercent('zero', cache, () => 0)).toBe(0)
    expect(cachedProjectPercent('zero', cache, () => { throw new Error('cached') })).toBe(0)
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
    expect(gaps(brokenExtra)).toEqual(['附件失效'])
    expect(itemMatchesGap(brokenExtra, 'unprepared')).toBe(true)
    expect(itemMatchesGap(brokenExtra, 'unfilled')).toBe(false)
    expect(itemMatchesGap(brokenExtra, 'unsigned')).toBe(false)
    expect(itemMatchesGap(brokenExtra, 'unarchived')).toBe(false)

    const brokenWhileNotApplicable = sampleItem({
      states: states({ prepared: 'na', filled: 'na', signed: 'na', archived: 'na' }),
      attachments: [attachment(false)]
    })
    expect(gaps(brokenWhileNotApplicable)).toEqual(['附件失效'])
    expect(itemMatchesGap(brokenWhileNotApplicable, 'unprepared')).toBe(true)
    expect(itemMatchesGap(brokenWhileNotApplicable, 'unfilled')).toBe(false)
  })
})

describe('pending grouping and remembered filters', () => {
  function row(id: string, project: { id: string; name: string }, owner: string) {
    return sample({ project, event: { owner }, item: { id, name: id } })
  }

  it('groups after filtering, keeps first-seen order, and omits empty groups', () => {
    const alpha = row('a1', { id: 'a', name: '甲项目' }, '经办甲')
    const beta = row('b1', { id: 'b', name: '乙项目' }, '经办甲')
    const alphaAgain = row('a2', { id: 'a', name: '甲项目' }, ' 经办乙 ')
    const rows = [beta, alpha, alphaAgain]
    const filtered = rows.filter(item => matchesPendingQuery(item, { ...openQuery(), projectId: 'a' }, '', 40))
    const byProject = groupPendingRows(filtered, 'project')
    expect(byProject.map(group => [group.key, group.label, group.rows.map(item => item.item.id)])).toEqual([['a', '甲项目', ['a1', 'a2']]])

    const byOwner = groupPendingRows(rows, 'owner')
    expect(byOwner.map(group => [group.key, group.label, group.rows.map(item => item.item.id)])).toEqual([
      ['经办甲', '经办甲', ['b1', 'a1']],
      ['经办乙', '经办乙', ['a2']]
    ])
    expect(groupPendingRows([beta, alpha], 'project').map(group => group.label)).toEqual(['乙项目', '甲项目'])
    expect(groupPendingRows(rows, 'none')).toEqual([{ key: '', label: '', rows }])
    expect(groupPendingRows([], 'project')).toEqual([])
    expect(groupPendingRows([], 'none')).toEqual([])
  })

  it('separates same-named projects and labels blank project or owner', () => {
    const named = row('a1', { id: 'a', name: '甲项目' }, '经办甲')
    const sameName = row('c1', { id: 'c', name: '甲项目' }, '经办甲')
    expect(groupPendingRows([named, sameName], 'project').map(group => group.key)).toEqual(['a', 'c'])
    const unnamed = row('u1', { id: 'u', name: '  ' }, '   ')
    expect(groupPendingRows([unnamed], 'project')[0]).toMatchObject({ key: 'u', label: '未命名项目' })
    expect(groupPendingRows([unnamed], 'owner')[0]).toMatchObject({ key: '', label: '未填写经办人' })
  })

  it('persists the pending filters and grouping mode, and ignores unusable storage', () => {
    const state = {
      filter: { keyword: ' 清单 ', projectId: 'p', customer: '客户', templateId: 't', owner: '经办', status: 'open' as const, gap: 'unsigned' as const },
      groupBy: 'owner' as const
    }
    const store = new Map<string, string>()
    writePendingViewState((key, value) => store.set(key, value), state)
    expect(store.has(PENDING_VIEW_STORAGE_KEY)).toBe(true)
    expect(readPendingViewState(key => store.get(key) ?? null)).toEqual(state)
    expect(JSON.parse(serializePendingViewState(state))).toEqual(state)

    writePendingViewState((key, value) => store.set(key, value), { filter: { ...openQuery(), status: 'done', gap: 'unprepared' }, groupBy: 'none' })
    const cleared = readPendingViewState(key => store.get(key) ?? null)
    expect(cleared.groupBy).toBe('none')
    expect(cleared.filter).toMatchObject({ keyword: '', status: 'done', gap: 'unprepared' })

    expect(defaultPendingViewState().groupBy).toBe('project')
    expect(readPendingViewState(() => null)).toEqual(defaultPendingViewState())
    expect(readPendingViewState(() => ' ')).toEqual(defaultPendingViewState())
    expect(readPendingViewState(() => '{')).toEqual(defaultPendingViewState())
    expect(readPendingViewState(() => { throw new Error('denied') })).toEqual(defaultPendingViewState())
    expect(parsePendingViewState(['nope'])).toEqual(defaultPendingViewState())
    expect(parsePendingViewState({ filter: { status: 'nope', gap: 'nope', keyword: 1, projectId: 'kept' }, groupBy: 'team' })).toEqual({
      filter: { ...openQuery(), projectId: 'kept' },
      groupBy: 'project'
    })
    expect(parsePendingViewState({ groupBy: 'none' }).filter).toEqual(openQuery())
    expect(JSON.parse(serializePendingViewState({ filter: openQuery(), groupBy: 'team' as PendingGroupBy })).groupBy).toBe('project')
  })
})
