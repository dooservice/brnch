import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { applyLiveEvent } from '@/modules/workspaces'
import type { RunNotice } from '@/modules/workspaces'
import { subscribe, insideTauri } from '@/lib/tauri'

/** Feeds what the agents do, as it happens, into the cached data every screen reads. */
export function LiveEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!insideTauri()) return
    let stop: (() => void) | null = null
    let cancelled = false
    subscribe<RunNotice>('agent-event', notice => applyLiveEvent(queryClient, notice)).then(unlisten => {
      if (cancelled) unlisten()
      else stop = unlisten
    })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [queryClient])

  return null
}
