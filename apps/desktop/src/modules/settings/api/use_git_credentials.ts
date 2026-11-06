import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { command } from '@/lib/tauri'
import type { GitCredential, GithubLoginPrompt, GithubLoginResult, RepositoryAccess } from '../types/settings.types'

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

/** Asks gitd for a code the person enters on github.com. */
export function useBeginGithubLogin() {
  return useMutation({ mutationFn: () => command<GithubLoginPrompt>('start_github_login') })
}

/** Waits until the person authorises on GitHub; gitd keeps the credential. */
export function useFinishGithubLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (loginIdentifier: string) => command<GithubLoginResult>('finish_github_login', { loginIdentifier }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: credentialsQuery.queryKey }),
  })
}

/** Whether gitd's credentials open one repository. */
export function useCheckRepositoryAccess() {
  return useMutation({ mutationFn: (repositoryUrl: string) => command<RepositoryAccess>('check_repository_access', { repositoryUrl }) })
}
