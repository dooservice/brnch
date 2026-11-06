import { queryOptions, useQuery } from '@tanstack/react-query'
import { command } from '@/lib/tauri'
import type { DiffSummary, ConflictSummary } from '../types/review.types'

export const diffQuery = (workspaceIdentifier: string, status: string) =>
  queryOptions({
    queryKey: ['diff', workspaceIdentifier, status] as const,
    queryFn: () => command<DiffSummary>('read_workspace_diff', { workspaceIdentifier }),
  })

const conflictsQuery = (projectIdentifier: string, fingerprint: string) =>
  queryOptions({
    queryKey: ['conflicts', projectIdentifier, fingerprint] as const,
    queryFn: () => command<ConflictSummary[]>('find_project_conflicts', { projectIdentifier }),
  })

/** What gitd reports changed in a workspace. Read again when the agent's state changes. */
export function useWorkspaceDiff(workspaceIdentifier: string | undefined, status: string) {
  return useQuery({ ...diffQuery(workspaceIdentifier ?? '', status), enabled: workspaceIdentifier !== undefined })
}

/** Which of the project's workspaces clash. `fingerprint` changes when any of them changes. */
export function useProjectConflicts(projectIdentifier: string | null, fingerprint: string, enabled = true) {
  return useQuery({ ...conflictsQuery(projectIdentifier ?? '', fingerprint), enabled: enabled && projectIdentifier !== null })
}
