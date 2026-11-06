import type { ModuleManifest } from '@/core/types'

export const manifest: ModuleManifest = {
  name: 'projects',
  version: '1.0.0',
  routes: [{ path: '/', page: () => import('./views/projects_home') }],
}
