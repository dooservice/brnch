import { STORAGE_PREFIX } from '@/lib/constants'

const KEY = `${STORAGE_PREFIX}onboarded`

/** Whether the first-start steps were finished or skipped once. */
export function isOnboarded(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export function markOnboarded(): void {
  try {
    window.localStorage.setItem(KEY, '1')
  } catch {
    // Without storage the steps simply show again next time.
  }
}
