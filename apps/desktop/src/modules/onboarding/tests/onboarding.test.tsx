import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { desktop } from '@/test/fake_desktop'
import { prepareApp, renderApp } from '@/test/render_app'

vi.mock('@/lib/tauri', async () => (await import('@/test/fake_tauri_module')).fakeTauriModule)

prepareApp()

describe('first start', () => {
  it('tells the person to sign out and in when Windows denies access to gitd', async () => {
    desktop.gitd = { connected: false, message: 'the workspace provider failed: Intento de acceso a un socket no permitido por sus permisos de acceso. (os error 10013) (Unavailable)' }

    renderApp('/welcome')

    expect(await screen.findByText(/Cierra sesión de Windows y vuelve a entrar/)).toBeInTheDocument()
  })

  it('hands a token to gitd and lists it, without gitd being edited by hand', async () => {
    const user = userEvent.setup()
    renderApp('/welcome')
    await user.click(await screen.findByRole('button', { name: /Siguiente/ }))
    await user.click(await screen.findByRole('button', { name: /Siguiente/ }))
    await user.click(await screen.findByRole('button', { name: /Siguiente/ }))

    await user.clear(await screen.findByLabelText(/Para qué repositorios/))
    await user.type(screen.getByLabelText(/Para qué repositorios/), 'https://github.com/acme')
    await user.type(screen.getByLabelText('Token de acceso'), 'github_pat_secret')
    await user.click(screen.getByRole('button', { name: 'Guardar en gitd' }))

    expect(await screen.findByText('https://github.com/acme')).toBeInTheDocument()
    expect(desktop.called('add_git_token')[0]).toEqual({ urlPrefix: 'https://github.com/acme', token: 'github_pat_secret' })
  })
})
