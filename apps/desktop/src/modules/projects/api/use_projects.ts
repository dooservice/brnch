import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { command } from '@/lib/tauri'
import type { Project, ProjectLayout, RepositoryInspection } from '../types/project.types'

const projectsQuery = queryOptions({
  queryKey: ['projects'] as const,
  queryFn: () => command<Project[]>('list_projects'),
})

const activeProjectQuery = queryOptions({
  queryKey: ['projects', 'active'] as const,
  queryFn: () => command<string | null>('active_project_identifier'),
})

export function useProjects() {
  return useQuery(projectsQuery)
}

export function useActiveProjectId(): string | null {
  const { data } = useQuery(activeProjectQuery)
  return data ?? null
}

/** The layout saved the last time the project was left, or null when it never was. */
export async function loadProjectLayout(projectIdentifier: string): Promise<ProjectLayout | null> {
  const json = await command<string | null>('load_view', { projectIdentifier })
  if (json === null) return null
  try {
    const parsed = JSON.parse(json) as Partial<ProjectLayout>
    return typeof parsed.path === 'string' ? { path: parsed.path } : null
  } catch {
    return null
  }
}

export function saveProjectLayout(projectIdentifier: string, layout: ProjectLayout): Promise<void> {
  return command<void>('save_view', { projectIdentifier, layoutJson: JSON.stringify(layout) })
}

export function useActivateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (identifier: string) => command<void>('activate_project', { identifier }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })
}

/** Makes a project the active one and returns to where it was left. */
export function useEnterProject() {
  const activate = useActivateProject()
  const navigate = useNavigate()
  return async (projectIdentifier: string) => {
    await activate.mutateAsync(projectIdentifier)
    const layout = await loadProjectLayout(projectIdentifier)
    navigate(layout?.path ?? '/')
  }
}

interface AddProjectInput {
  name: string
  repositoryUrl: string
  baseBranch: string | null
  workspacesDirectory: string | null
  /** Whether to open the project once it is added. */
  open: boolean
}

export function useAddProject() {
  const queryClient = useQueryClient()
  const enter = useEnterProject()
  return useMutation({
    mutationFn: ({ open, ...input }: AddProjectInput) => command<Project>('add_project', input).then(created => ({ created, open })),
    onSuccess: async ({ created, open }) => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      if (open) await enter(created.identifier)
    },
  })
}

/** Asks the repository's server whether it answers and which branches it has. */
export function useRepositoryInspection(location: string) {
  return useQuery({
    queryKey: ['repository', location] as const,
    queryFn: () => command<RepositoryInspection>('inspect_repository', { location }),
    enabled: location.trim() !== '',
    staleTime: 60_000,
  })
}
