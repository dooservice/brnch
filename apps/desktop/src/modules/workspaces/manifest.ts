import type { ModuleManifest } from '@/core/types'

export const manifest: ModuleManifest = {
  name: 'workspaces',
  version: '1.0.0',
  depends: ['projects'],
  routes: [
    { path: '/workspaces/:workspaceId', page: () => import('./views/workspace_agent') },
  ],
}
