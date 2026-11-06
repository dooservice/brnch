import { render } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { beforeAll, beforeEach } from 'vitest'
import i18next from '@/lib/i18n'
import { queryClient } from '@/app/query_client'
import { bootstrap } from '@/app/bootstrap'
import { buildRouter } from '@/app/router'
import App from '@/App'
import { reviewMarks } from '@/modules/review/lib/review_marks'
import { desktop } from './fake_desktop'

/** Starts every test with an empty desktop, a clean cache and the interface in Spanish. */
export function prepareApp(): void {
  beforeAll(async () => {
    await bootstrap()
  })
  beforeEach(async () => {
    desktop.reset()
    queryClient.clear()
    reviewMarks.reset()
    await i18next.changeLanguage('es')
  })
}

export function renderApp(path = '/') {
  const router = buildRouter(path)
  render(<App router={router} />)
  return router
}

export type { QueryClient }
