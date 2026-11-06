import type { ModuleManifest } from '@/core/types'

export const manifest: ModuleManifest = {
  name: 'terminal',
  version: '1.0.0',
  depends: ['workspaces'],
  routes: [{ path: '/workspaces/:workspaceId/terminal', page: () => import('./views/workspace_terminal') }],
}
