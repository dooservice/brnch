import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { command } from '@/lib/tauri'
import type { Project, ProjectLayout } from '../types/project.types'

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

export function useAddProject() {
  const queryClient = useQueryClient()
  const enter = useEnterProject()
  return useMutation({
    mutationFn: (input: { name: string; repositoryUrl: string }) => command<Project>('add_project', input),
    onSuccess: async created => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await enter(created.identifier)
    },
  })
}
