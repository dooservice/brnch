import type { ModuleManifest } from '@/core/types'

export const manifest: ModuleManifest = {
  name: 'runs',
  version: '1.0.0',
  depends: ['projects', 'workspaces', 'settings'],
  routes: [{ path: '/runs/:runId', page: () => import('./views/run_compare') }],
}
