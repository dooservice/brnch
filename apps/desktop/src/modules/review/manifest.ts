import type { ModuleManifest } from '@/core/types'

export const manifest: ModuleManifest = {
  name: 'review',
  version: '1.0.0',
  depends: ['workspaces'],
  routes: [{ path: '/workspaces/:workspaceId/changes', page: () => import('./views/workspace_changes') }],
}
