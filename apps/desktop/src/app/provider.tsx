import { QueryClientProvider } from '@tanstack/react-query'
import { LiveEvents } from '@/app/live_events'
import { queryClient } from '@/app/query_client'

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LiveEvents />
      {children}
    </QueryClientProvider>
  )
}
