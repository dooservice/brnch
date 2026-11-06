import type { ModuleManifest } from '@/core/types'

export const manifest: ModuleManifest = {
  name: 'editor',
  version: '1.0.0',
  depends: ['workspaces'],
  routes: [{ path: '/workspaces/:workspaceId/files', page: () => import('./views/workspace_files') }],
}
