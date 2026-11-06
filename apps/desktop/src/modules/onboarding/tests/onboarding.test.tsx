import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { desktop } from '@/test/fake_desktop'
import { prepareApp, renderApp } from '@/test/render_app'

vi.mock('@/lib/tauri', async () => (await import('@/test/fake_tauri_module')).fakeTauriModule)

prepareApp()

async function openPublishingStep(user: ReturnType<typeof userEvent.setup>) {
  renderApp('/welcome')
  for (let step = 0; step < 3; step++) await user.click(await screen.findByRole('button', { name: /Siguiente/ }))
}

describe('first start', () => {
  it('tells the person to sign out and in when Windows denies access to gitd', async () => {
    desktop.gitd = { connected: false, message: 'the workspace provider failed: Intento de acceso a un socket no permitido por sus permisos de acceso. (os error 10013) (Unavailable)' }

    renderApp('/welcome')

    expect(await screen.findByText(/Cierra sesión de Windows y vuelve a entrar/)).toBeInTheDocument()
  })

  it('offers the three ways to connect before anything is connected', async () => {
    const user = userEvent.setup()
    await openPublishingStep(user)

    expect(await screen.findByText('Iniciar sesión con GitHub')).toBeInTheDocument()
    expect(screen.getByText('Clave SSH')).toBeInTheDocument()
    expect(screen.getByText('Token de acceso')).toBeInTheDocument()
  })

  it('signs in with a code: shows it, opens GitHub, and lists the account once authorised', async () => {
    const user = userEvent.setup()
    await openPublishingStep(user)

    await user.click(await screen.findByRole('button', { name: 'Continuar con GitHub' }))
    expect(await screen.findByText('@josue')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Elegir repositorios en GitHub' }))
    await user.click(screen.getByRole('button', { name: 'Probar acceso' }))

    expect(desktop.opened).toEqual(['https://github.com/apps/gitd-app/installations/new'])
    expect(await screen.findByText(/gitd puede leer este repositorio · rama principal main/)).toBeInTheDocument()
  })

  it('says why gitd cannot reach a repository', async () => {
    const user = userEvent.setup()
    desktop.repositoryAccess = { level: 'denied', defaultBranch: '', failure: 'Repository not found.' }
    await openPublishingStep(user)

    await user.click(await screen.findByRole('button', { name: 'Continuar con GitHub' }))
    await user.click(await screen.findByRole('button', { name: 'Probar acceso' }))

    expect(await screen.findByText(/gitd no llega a este repositorio.*Repository not found\./)).toBeInTheDocument()
  })

  it('hands a token to gitd and lists it afterwards', async () => {
    const user = userEvent.setup()
    await openPublishingStep(user)

    await user.click(await screen.findByRole('button', { name: 'Pegar un token' }))
    await user.clear(screen.getByLabelText(/Para qué repositorios/))
    await user.type(screen.getByLabelText(/Para qué repositorios/), 'https://github.com/acme')
    await user.type(screen.getByLabelText('Token de acceso'), 'github_pat_secret')
    await user.click(screen.getByRole('button', { name: 'Guardar en gitd' }))

    expect(await screen.findByText('https://github.com/acme')).toBeInTheDocument()
    expect(desktop.called('add_git_token')[0]).toEqual({ urlPrefix: 'https://github.com/acme', token: 'github_pat_secret' })
  })

  it('removes a connection from the settings page', async () => {
    const user = userEvent.setup()
    desktop.credentials = [{ identifier: 'c1', kind: 'token', urlPrefix: 'https://github.com/acme', actsAs: '' }]
    renderApp('/settings/connections')

    await user.click(await screen.findByRole('button', { name: 'Quitar la conexión https://github.com/acme' }))

    expect(await screen.findByText('Iniciar sesión con GitHub')).toBeInTheDocument()
  })

  it('makes an SSH key, shows only its public half, and keeps it once GitHub accepts it', async () => {
    const user = userEvent.setup()
    await openPublishingStep(user)

    await user.click(await screen.findByRole('button', { name: 'Crear clave' }))
    expect(await screen.findByText(/ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ4k/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Abrir GitHub › Settings › SSH keys/ }))
    await user.click(screen.getByRole('button', { name: 'Comprobar' }))

    expect(desktop.opened).toEqual(['https://github.com/settings/ssh/new'])
    expect(await screen.findByText(/GitHub reconoce la clave/)).toBeInTheDocument()
  })

  it('says so when GitHub does not know the key yet, and does not finish', async () => {
    const user = userEvent.setup()
    desktop.sshAccepted = false
    await openPublishingStep(user)

    await user.click(await screen.findByRole('button', { name: 'Crear clave' }))
    await user.click(await screen.findByRole('button', { name: 'Comprobar' }))

    expect(await screen.findByText(/GitHub aún no reconoce la clave.*AUTH_REFUSED/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Listo' })).not.toBeInTheDocument()
  })
})
