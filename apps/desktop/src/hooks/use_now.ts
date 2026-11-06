import { useEffect, useState } from 'react'

/** The current time, refreshed so "6 min" labels stay right while the window is open. */
export function useNow(refreshMilliseconds = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), refreshMilliseconds)
    return () => window.clearInterval(timer)
  }, [refreshMilliseconds])
  return now
}
