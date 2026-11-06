import { describe, expect, it } from 'vitest'
import type { Workspace } from '@/modules/workspaces'
import { recommendWorkspace } from './recommend_run'
import { deriveRunLabel } from './run_label'

const workspace = (identifier: string, status: Workspace['status'], cost: number | null): Workspace => ({
  identifier, directory: '/w', branchName: identifier, title: 't', agentLabel: 'Claude Code', runIdentifier: 'r',
  status, startedAtMilliseconds: null, costInDollars: cost, durationInMilliseconds: null, totalTokens: null, permissionMode: null, baseCommit: null,
})

describe('recommendWorkspace', () => {
  it('picks the cheapest finished workspace that clashes with nobody', () => {
    const picked = recommendWorkspace([workspace('a', 'done', 0.5), workspace('b', 'done', 0.2), workspace('c', 'done', 0.1), workspace('d', 'failed', 0.01)], new Set(['c']))

    expect(picked?.identifier).toBe('b')
  })

  it('recommends nothing while none qualifies', () => {
    expect(recommendWorkspace([workspace('a', 'running', null), workspace('b', 'failed', 0.1)], new Set())).toBeNull()
  })
})

describe('deriveRunLabel', () => {
  it('keeps the first words of the task', () => {
    expect(deriveRunLabel('  Add a search by name to the catalog with tests  ')).toBe('Add a search by name to')
  })
})
