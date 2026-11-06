import { useEffect, useState } from 'react'

/** The value, but only after it has stopped changing for a moment. */
export function useDebouncedValue<Value>(value: Value, delayMilliseconds = 450): Value {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMilliseconds)
    return () => window.clearTimeout(timer)
  }, [value, delayMilliseconds])
  return settled
}
