import { queryOptions, useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { command } from '@/lib/tauri'
import { useProjects } from '@/modules/projects'
import type { Project } from '@/modules/projects'
import type { Workspace } from '../types/workspace.types'

export const workspacesQuery = (projectIdentifier: string) =>
  queryOptions({
    queryKey: ['workspaces', projectIdentifier] as const,
    queryFn: () => command<Workspace[]>('list_workspaces', { projectIdentifier }),
    staleTime: 0,
  })

export interface ProjectWorkspaces {
  project: Project
  workspaces: Workspace[]
}

/** Every project with its workspaces: what the sidebar draws and what Ctrl K searches. */
export function useAllWorkspaces(): ProjectWorkspaces[] {
  const { data: projects = [] } = useProjects()
  const results = useQueries({ queries: projects.map(project => workspacesQuery(project.identifier)) })
  return projects.map((project, index) => ({ project, workspaces: results[index]?.data ?? [] }))
}

/** One workspace and the project it belongs to, wherever it is. */
export function useWorkspace(workspaceIdentifier: string | undefined) {
  const all = useAllWorkspaces()
  for (const entry of all) {
    const workspace = entry.workspaces.find(candidate => candidate.identifier === workspaceIdentifier)
    if (workspace) return { workspace, project: entry.project }
  }
  return { workspace: null, project: null }
}

export function useStopRun() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (workspaceIdentifier: string) => command<boolean>('stop_run', { workspaceIdentifier }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

export function useSendFollowUp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { workspaceIdentifier: string; prompt: string }) => command<void>('send_follow_up', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}
