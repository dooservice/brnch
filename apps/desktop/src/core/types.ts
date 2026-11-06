import type * as React from 'react'

export type InheritPosition = 'replace' | 'before' | 'after' | 'inside'

export interface RouteDefinition {
  path: string
  page?: () => Promise<{ default: React.ComponentType }>
  redirect?: string
}

export interface ModuleManifest {
  name: string
  version?: string
  depends?: string[]
  routes?: RouteDefinition[]
}

export interface SlotEntry {
  id: string
  slot: string
  position: InheritPosition
  component: React.ComponentType
  priority: number
}

export interface Registry {
  router: import('./router_registry').RouterRegistry
  components: import('./component_registry').ComponentRegistry
}

export interface IModule {
  manifest: ModuleManifest
  /** Optional: most modules only declare routes, and have nothing to contribute. */
  setup?: (registry: Registry) => void | Promise<void>
}
