import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@/lib/i18n'
import { bootstrap } from '@/app/bootstrap'
import { buildRouter } from '@/app/router'
import App from '@/App'

bootstrap().then(() => {
  const router = buildRouter()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App router={router} />
    </StrictMode>,
  )
})
