import type { ModuleManifest } from '@/core/types'

export const manifest: ModuleManifest = {
  name: 'settings',
  version: '1.0.0',
  routes: [
    { path: '/settings', redirect: '/settings/general' },
    { path: '/settings/general', page: () => import('./views/settings_general') },
    { path: '/settings/agents', page: () => import('./views/settings_agents') },
    { path: '/settings/security', page: () => import('./views/settings_security') },
  ],
}
