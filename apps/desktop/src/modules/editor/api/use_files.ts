import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { command } from '@/lib/tauri'
import type { FileContent, FileEntry, TextMatch } from '../types/editor.types'

export const directoryQuery = (workspaceIdentifier: string, relativePath: string) =>
  queryOptions({
    queryKey: ['files', workspaceIdentifier, 'directory', relativePath] as const,
    queryFn: () => command<FileEntry[]>('list_workspace_files', { workspaceIdentifier, relativePath }),
  })

export function useDirectory(workspaceIdentifier: string, relativePath: string, enabled = true) {
  return useQuery({ ...directoryQuery(workspaceIdentifier, relativePath), enabled })
}

export function useFile(workspaceIdentifier: string, relativePath: string) {
  return useQuery({
    queryKey: ['files', workspaceIdentifier, 'file', relativePath] as const,
    queryFn: () => command<FileContent>('read_workspace_file', { workspaceIdentifier, relativePath }),
    staleTime: Infinity,
    gcTime: 0,
  })
}

export function useSaveFile(workspaceIdentifier: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { relativePath: string; content: string }) => command<void>('write_workspace_file', { workspaceIdentifier, ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diff', workspaceIdentifier] }),
  })
}

export function useFindFiles(workspaceIdentifier: string, query: string) {
  return useQuery({
    queryKey: ['files', workspaceIdentifier, 'find', query] as const,
    queryFn: () => command<string[]>('find_workspace_files', { workspaceIdentifier, query }),
    enabled: query.trim() !== '',
  })
}

export function useFindText(workspaceIdentifier: string, query: string) {
  return useQuery({
    queryKey: ['files', workspaceIdentifier, 'text', query] as const,
    queryFn: () => command<TextMatch[]>('find_workspace_text', { workspaceIdentifier, query }),
    enabled: query.trim() !== '',
  })
}
