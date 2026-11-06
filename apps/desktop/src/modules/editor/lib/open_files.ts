import { useSyncExternalStore } from 'react'
import { STORAGE_PREFIX } from '@/lib/constants'
import type { OpenFiles } from '../types/editor.types'

type Listener = () => void

const EMPTY: OpenFiles = { paths: [], active: null }

/**
 * The files each workspace has open in its editor and which one is in front. Kept in memory and in
 * local storage, so closing the window and coming back finds the same tabs.
 */
export class OpenFilesStore {
  private readonly byWorkspace = new Map<string, OpenFiles>()
  private readonly listeners = new Set<Listener>()
  private version = 0

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getVersion = (): number => this.version

  get(workspaceIdentifier: string): OpenFiles {
    const known = this.byWorkspace.get(workspaceIdentifier)
    if (known !== undefined) return known
    const restored = this.restore(workspaceIdentifier)
    this.byWorkspace.set(workspaceIdentifier, restored)
    return restored
  }

  open(workspaceIdentifier: string, path: string): void {
    const current = this.get(workspaceIdentifier)
    const paths = current.paths.includes(path) ? current.paths : [...current.paths, path]
    this.set(workspaceIdentifier, { paths, active: path })
  }

  activate(workspaceIdentifier: string, path: string): void {
    this.set(workspaceIdentifier, { ...this.get(workspaceIdentifier), active: path })
  }

  close(workspaceIdentifier: string, path: string): void {
    const current = this.get(workspaceIdentifier)
    const paths = current.paths.filter(candidate => candidate !== path)
    const index = current.paths.indexOf(path)
    const active = current.active === path ? (paths[Math.min(index, paths.length - 1)] ?? null) : current.active
    this.set(workspaceIdentifier, { paths, active })
  }

  reset(): void {
    this.byWorkspace.clear()
    this.version += 1
    this.listeners.forEach(listener => listener())
  }

  private set(workspaceIdentifier: string, files: OpenFiles): void {
    this.byWorkspace.set(workspaceIdentifier, files)
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}open_files.${workspaceIdentifier}`, JSON.stringify(files))
    } catch {
      // Without storage the tabs only last until the window closes.
    }
    this.version += 1
    this.listeners.forEach(listener => listener())
  }

  private restore(workspaceIdentifier: string): OpenFiles {
    try {
      const stored = window.localStorage.getItem(`${STORAGE_PREFIX}open_files.${workspaceIdentifier}`)
      if (stored === null) return EMPTY
      const parsed = JSON.parse(stored) as Partial<OpenFiles>
      const paths = Array.isArray(parsed.paths) ? parsed.paths.filter((path): path is string => typeof path === 'string') : []
      return { paths, active: typeof parsed.active === 'string' && paths.includes(parsed.active) ? parsed.active : (paths[0] ?? null) }
    } catch {
      return EMPTY
    }
  }
}

export const openFilesStore = new OpenFilesStore()

/** The workspace's open files, repainting the component when they change. */
export function useOpenFiles(workspaceIdentifier: string): { files: OpenFiles; store: OpenFilesStore } {
  useSyncExternalStore(openFilesStore.subscribe, openFilesStore.getVersion)
  return { files: openFilesStore.get(workspaceIdentifier), store: openFilesStore }
}
