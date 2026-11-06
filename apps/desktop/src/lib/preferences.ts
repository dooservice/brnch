import { useSyncExternalStore } from 'react'
import { STORAGE_PREFIX } from '@/lib/constants'

type Listener = () => void

const listeners = new Set<Listener>()

function read(name: string): string | null {
  try {
    return window.localStorage.getItem(`${STORAGE_PREFIX}${name}`)
  } catch {
    return null
  }
}

function write(name: string, value: string): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${name}`, value)
  } catch {
    // Without storage the choice only lasts until the window closes.
  }
  listeners.forEach(listener => listener())
}

const subscribe = (listener: Listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export type DefaultPermission = 'edit_files' | 'plan_only'

/** The permission a new run starts with; a person changes it in Settings › Agents. */
export function useDefaultPermission(): [DefaultPermission, (value: DefaultPermission) => void] {
  const stored = useSyncExternalStore(subscribe, () => read('default_permission'))
  return [stored === 'plan_only' ? 'plan_only' : 'edit_files', value => write('default_permission', value)]
}
