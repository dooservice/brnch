import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { command } from '@/lib/tauri'
import type { StartRunInput } from '../types/run.types'

/** Starts the agents and opens the first of their workspaces. */
export function useStartRun() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (request: StartRunInput) => command<string[]>('start_run', { request }),
    onSuccess: async workspaces => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      if (workspaces[0] !== undefined) navigate(`/workspaces/${workspaces[0]}`)
    },
  })
}
