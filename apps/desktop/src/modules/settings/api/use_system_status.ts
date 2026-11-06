import { queryOptions, useQuery } from '@tanstack/react-query'
import { command } from '@/lib/tauri'
import type { AgentInstallation, GitdStatus, SandboxStatus } from '../types/settings.types'

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
