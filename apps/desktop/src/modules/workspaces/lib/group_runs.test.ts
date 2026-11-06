import { describe, expect, it } from 'vitest'
import type { Workspace } from '../types/workspace.types'
import { groupRuns } from './group_runs'

const workspace = (identifier: string, runIdentifier: string | null): Workspace => ({
  identifier, directory: '/w', branchName: identifier, title: `Task ${runIdentifier}`, agentLabel: 'Claude Code',
  runIdentifier, status: 'done', startedAtMilliseconds: null, costInDollars: null, durationInMilliseconds: null, totalTokens: null, permissionMode: null, baseCommit: null,
})

describe('groupRuns', () => {
  it('groups the workspaces of a run that has several and leaves the rest single', () => {
    const { groups, singles } = groupRuns([workspace('a', 'r1'), workspace('b', 'r1'), workspace('c', 'r2'), workspace('d', null)])

    expect(groups.map(group => [group.runIdentifier, group.workspaces.map(item => item.identifier)])).toEqual([['r1', ['a', 'b']]])
    expect(singles.map(item => item.identifier).sort()).toEqual(['c', 'd'])
  })
})
