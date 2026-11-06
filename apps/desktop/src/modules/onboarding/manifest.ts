import type { ModuleManifest } from '@/core/types'

export const manifest: ModuleManifest = {
  name: 'onboarding',
  version: '1.0.0',
  depends: ['projects', 'settings'],
  routes: [{ path: '/welcome', page: () => import('./views/onboarding_wizard') }],
}
