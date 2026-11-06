import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { openUrl } from '@tauri-apps/plugin-opener'

/** True when the page runs inside the Tauri window and not in a plain browser. */
export function insideTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}

/** Calls a Rust command. Every module keeps its own typed wrappers around this. */
export function command<Result>(name: string, args?: Record<string, unknown>): Promise<Result> {
  return invoke<Result>(name, args)
}

/** Listens to an event the Rust side emits; resolves to the function that stops listening. */
export function subscribe<Payload>(eventName: string, listener: (payload: Payload) => void): Promise<() => void> {
  return listen<Payload>(eventName, event => listener(event.payload))
}

/** What a person reads when a command fails: Rust sends its failures as plain text. */
export function failureText(error: unknown): string {
  return typeof error === 'string' ? error : error instanceof Error ? error.message : String(error)
}

/** Opens an address in the person's own browser, never inside the window. */
export function openExternal(url: string): Promise<void> {
  return openUrl(url)
}
