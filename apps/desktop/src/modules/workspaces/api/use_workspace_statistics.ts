import { useQueries } from '@tanstack/react-query'
import { command } from '@/lib/tauri'
import type { Workspace, WorkspaceStatistics } from '../types/workspace.types'
import type { ProjectWorkspaces } from './use_workspaces'

/** The statistics of every workspace that has had a task, read again when any state changes. */
export function useWorkspaceStatistics(all: readonly ProjectWorkspaces[]): Map<string, WorkspaceStatistics> {
  const results = useQueries({
    queries: all.map(({ project, workspaces }) => ({
      queryKey: ['statistics', project.identifier, fingerprintOf(workspaces)] as const,
      queryFn: () => command<WorkspaceStatistics[]>('workspace_statistics', { projectIdentifier: project.identifier }),
      enabled: workspaces.some(workspace => workspace.runIdentifier !== null),
      staleTime: 30_000,
    })),
  })
  const statistics = new Map<string, WorkspaceStatistics>()
  results.forEach(result => result.data?.forEach(entry => statistics.set(entry.workspaceIdentifier, entry)))
  return statistics
}

function fingerprintOf(workspaces: readonly Workspace[]): string {
  return workspaces.map(workspace => `${workspace.identifier}:${workspace.status}`).join(',')
}
