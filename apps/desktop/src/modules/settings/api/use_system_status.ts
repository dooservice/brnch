import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { command } from '@/lib/tauri'
import type { AgentInstallation, GitdStatus, SandboxProbeReport, SandboxStatus } from '../types/settings.types'

const sandboxQuery = queryOptions({
  queryKey: ['system', 'sandbox'] as const,
  queryFn: () => command<SandboxStatus>('sandbox_status'),
  staleTime: 60_000,
})

const agentsQuery = queryOptions({
  queryKey: ['system', 'agents'] as const,
  queryFn: () => command<AgentInstallation[]>('detect_agents'),
  staleTime: 60_000,
})

const gitdQuery = queryOptions({
  queryKey: ['system', 'gitd'] as const,
  queryFn: () => command<GitdStatus>('gitd_status'),
  staleTime: 15_000,
})

/** Whether agents can be confined on this system. */
export function useSandboxStatus() {
  return useQuery(sandboxQuery)
}

/** Which agents are installed on this machine. */
export function useAgentInstallations() {
  return useQuery(agentsQuery)
}

/** Whether gitd answers. */
export function useGitdStatus() {
  return useQuery(gitdQuery)
}

/** Measures what a confined agent can reach. */
export function useProbeSandbox() {
  return useMutation({ mutationFn: () => command<SandboxProbeReport>('probe_sandbox') })
}

/** Makes the account agents run under on Windows; Windows asks for permission once. */
export function useSetupAgentAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => command<SandboxStatus>('setup_agent_account'),
    onSuccess: status => queryClient.setQueryData(['system', 'sandbox'], status),
  })
}

/** Keeps, or with null forgets, the API key agents receive. */
export function useSetAgentApiKey() {
  return useMutation({ mutationFn: (apiKey: string | null) => command<void>('set_agent_api_key', { apiKey }) })
}
