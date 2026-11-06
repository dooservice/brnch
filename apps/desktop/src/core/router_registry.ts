import type { RouteDefinition } from './types'

class RouterRegistry {
  private readonly routes: RouteDefinition[] = []

  add(routes: RouteDefinition[]): void {
    this.routes.push(...routes)
  }

  getAll(): RouteDefinition[] {
    return [...this.routes]
  }
}

export { RouterRegistry }
export const routerRegistry = new RouterRegistry()
