import { queryOptions, useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { command } from '@/lib/tauri'
import type { AgentEvent, RunNotice, TimelineEntry } from '../types/workspace.types'

const toEntry = (notice: RunNotice): TimelineEntry => ({ sequence: notice.sequence, event: JSON.parse(notice.eventJson) as AgentEvent })

const eventsQuery = (workspaceIdentifier: string) =>
  queryOptions({
    queryKey: ['events', workspaceIdentifier] as const,
    queryFn: async () => (await command<RunNotice[]>('list_workspace_events', { workspaceIdentifier, afterSequence: 0 })).map(toEntry),
    staleTime: Infinity,
  })

/** What the agent of a workspace has done: the history from disk, kept up to date live. */
export function useWorkspaceEvents(workspaceIdentifier: string | undefined) {
  return useQuery({ ...eventsQuery(workspaceIdentifier ?? ''), enabled: workspaceIdentifier !== undefined })
}

/**
 * Adds an event that just happened to what is cached. An event the history already holds is
 * kept once, and the workspace states are refreshed when a task starts or ends.
 */
export function applyLiveEvent(queryClient: QueryClient, notice: RunNotice): void {
  const entry = toEntry(notice)
  queryClient.setQueryData<TimelineEntry[]>(['events', notice.workspaceIdentifier], current => {
    if (current === undefined || current.some(existing => existing.sequence === entry.sequence)) return current
    return [...current, entry].sort((first, second) => first.sequence - second.sequence)
  })
  if (entry.event.kind === 'user_message' || entry.event.kind === 'run_finished') {
    void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
  }
}
