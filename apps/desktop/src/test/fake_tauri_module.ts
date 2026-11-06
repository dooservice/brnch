import { desktop } from './fake_desktop'

/** Replaces `@/lib/tauri` in tests so screens talk to the in-memory desktop. */
export const fakeTauriModule = {
  insideTauri: () => true,
  command: (name: string, args?: Record<string, unknown>) => desktop.handle(name, args),
  subscribe: (eventName: string, listener: (payload: never) => void) => Promise.resolve(eventName === "agent-event" ? desktop.subscribe(listener as never) : () => undefined),
  failureText: (error: unknown) => (typeof error === 'string' ? error : error instanceof Error ? error.message : String(error)),
}
