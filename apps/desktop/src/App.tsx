import { RouterProvider } from 'react-router-dom'
import { AppProvider } from '@/app/provider'
import type { buildRouter } from '@/app/router'

interface AppProps {
  router: ReturnType<typeof buildRouter>
}

export default function App({ router }: AppProps) {
  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  )
}
