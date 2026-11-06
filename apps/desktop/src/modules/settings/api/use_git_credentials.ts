import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { command } from '@/lib/tauri'
import type { GitCredential } from '../types/settings.types'

const credentialsQuery = queryOptions({
  queryKey: ['system', 'git-credentials'] as const,
  queryFn: () => command<GitCredential[]>('list_git_credentials'),
})

/** The credentials gitd keeps; `enabled` waits for gitd to answer. */
export function useGitCredentials(enabled: boolean) {
  return useQuery({ ...credentialsQuery, enabled })
}

/** Hands a token to gitd, which keeps it. */
export function useAddGitToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { urlPrefix: string; token: string }) => command<GitCredential>('add_git_token', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: credentialsQuery.queryKey }),
  })
}

export function useRemoveGitCredential() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (identifier: string) => command<void>('remove_git_credential', { identifier }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: credentialsQuery.queryKey }),
  })
}
