import { QueryClient } from '@tanstack/react-query'

/** Data lives in this machine, so a stale answer is cheap to refresh and never worth retrying. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 5_000, refetchOnWindowFocus: false },
  },
})
