import { useMutation, useQueryClient } from '@tanstack/react-query'
import { command } from '@/lib/tauri'
import type { PublishOutcome } from '@/modules/workspaces'

/** gitd pushes each branch with the token it holds; the agent never had it. */
export function usePublish() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (workspaceIdentifiers: string[]) => command<PublishOutcome[]>('publish_workspaces', { workspaceIdentifiers }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}
