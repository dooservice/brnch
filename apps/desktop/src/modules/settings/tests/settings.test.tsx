import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import i18next from '@/lib/i18n'
import { desktop } from '@/test/fake_desktop'
import { prepareApp, renderApp } from '@/test/render_app'

vi.mock('@/lib/tauri', async () => (await import('@/test/fake_tauri_module')).fakeTauriModule)

prepareApp()

describe('security measurement', () => {
  it('says "not checked" until the probe runs, then shows what it measured', async () => {
    const user = userEvent.setup()
    renderApp('/settings/security')
    expect((await screen.findAllByText('Sin comprobar')).length).toBeGreaterThan(0)

    await user.click(await screen.findByRole('button', { name: 'Comprobar ahora' }))

    expect(await screen.findAllByText('Oculto')).toHaveLength(4)
    expect(screen.getByText('El agente confinado pudo escribir en su workspace.')).toBeInTheDocument()
    expect(desktop.called('probe_sandbox')).toHaveLength(1)
  })

  it('reports files that are readable when the probe finds the isolation leaks', async () => {
    const user = userEvent.setup()
    desktop.probeReport = { homeHidden: false, workspaceWritable: true, failure: null }
    renderApp('/settings/security')

    await user.click(await screen.findByRole('button', { name: 'Comprobar ahora' }))

    expect(await screen.findAllByText('Visible')).toHaveLength(4)
  })

  it('cannot be run without isolation', async () => {
    desktop.sandbox = { available: false, mechanism: 'none', reason: 'no sandbox' }
    renderApp('/settings/security')

    expect(await screen.findByRole('button', { name: 'Comprobar ahora' })).toBeDisabled()
  })
})

describe('settings', () => {
  it('changes the language of the whole interface and remembers it', async () => {
    const user = userEvent.setup()
    renderApp('/settings/general')

    await user.selectOptions(await screen.findByLabelText('Idioma'), 'en')

    expect(await screen.findByRole('heading', { name: 'General' })).toBeInTheDocument()
    expect(screen.getByLabelText('Language')).toHaveValue('en')
    expect(screen.getByRole('link', { name: 'Back to the app' })).toBeInTheDocument()
    expect(i18next.language).toBe('en')
    expect(window.localStorage.getItem('brnch.language')).toBe('en')
  })

  it('shows whether Claude Code is installed and does not pretend about the other agents', async () => {
    desktop.agents = [{ kind: 'claude_code', installed: true, version: '2.1.0' }]
    renderApp('/settings/agents')

    expect(await screen.findByText('Instalado')).toBeInTheDocument()
    expect(screen.getAllByText('Próximamente')).toHaveLength(3)
  })

  it('explains why there is no isolation instead of showing a green shield', async () => {
    desktop.sandbox = { available: false, mechanism: 'dedicated Windows account', reason: 'starting agents under the dedicated account is not verified yet' }
    renderApp('/settings/security')

    expect(await screen.findByText(/not verified yet/)).toBeInTheDocument()
    expect(screen.getByText('Sin aislamiento disponible: los agentes no se ejecutarán')).toBeInTheDocument()
  })
})
