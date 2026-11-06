import type { IModule } from './types'
import { RouterRegistry, routerRegistry } from './router_registry'
import { ComponentRegistry, componentRegistry } from './component_registry'

class ModuleRegistry {
  private readonly modules: IModule[] = []
  private bootstrapped = false

  register(module: IModule): void {
    if (this.bootstrapped) {
      throw new Error(`[ModuleRegistry] Cannot register "${module.manifest.name}" after bootstrap.`)
    }
    this.modules.push(module)
  }

  async bootstrap(): Promise<void> {
    if (this.bootstrapped) return
    this.bootstrapped = true

    const ordered = this.resolveOrder()
    const registry = { router: routerRegistry, components: componentRegistry }

    for (const module of ordered) {
      if (module.manifest.routes?.length) {
        routerRegistry.add(module.manifest.routes)
      }
      await module.setup?.(registry)
    }
  }

  getLoaded(): IModule[] {
    return [...this.modules]
  }

  private resolveOrder(): IModule[] {
    const byName = new Map(this.modules.map(module => [module.manifest.name, module]))
    const visited = new Set<string>()
    const result: IModule[] = []

    const visit = (name: string, chain: string[] = []) => {
      if (visited.has(name)) return
      if (chain.includes(name)) {
        throw new Error(`[ModuleRegistry] Circular dependency: ${[...chain, name].join(' → ')}`)
      }
      const module = byName.get(name)
      if (!module) {
        throw new Error(`[ModuleRegistry] Missing module "${name}" (required by ${chain.at(-1) ?? '?'})`)
      }
      for (const dependency of module.manifest.depends ?? []) {
        visit(dependency, [...chain, name])
      }
      visited.add(name)
      result.push(module)
    }

    for (const module of this.modules) {
      visit(module.manifest.name)
    }

    return result
  }
}

export { ModuleRegistry, RouterRegistry, ComponentRegistry }
export const moduleRegistry = new ModuleRegistry()
