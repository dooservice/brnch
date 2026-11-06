import * as React from 'react'
import { createMemoryRouter, Navigate } from 'react-router-dom'
import type { RouteDefinition } from '@/core/types'
import { routerRegistry } from '@/core'
import { ShellLayout } from '@/modules/shell'
import Spinner from '@/components/spinner'

const fallback = (
  <div className="flex flex-1 justify-center py-16">
    <Spinner className="h-6 w-6 animate-spin text-muted" />
  </div>
)

function lazyElement(load: () => Promise<{ default: React.ComponentType }>) {
  const Page = React.lazy(load)
  return (
    <React.Suspense fallback={fallback}>
      <Page />
    </React.Suspense>
  )
}

function toRouteObject(route: RouteDefinition) {
  if (route.redirect) return { path: route.path, element: <Navigate to={route.redirect} replace /> }
  return { path: route.path, element: lazyElement(route.page!) }
}

/** The shell wraps every page; modules only say which pages exist. */
export function buildRouter(initialPath = '/') {
  const children = routerRegistry.getAll().map(toRouteObject)
  return createMemoryRouter([{ element: <ShellLayout />, children }], { initialEntries: [initialPath] })
}
