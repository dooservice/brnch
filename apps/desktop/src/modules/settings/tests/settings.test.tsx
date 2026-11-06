import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import i18next from '@/lib/i18n'
import { desktop } from '@/test/fake_desktop'
import { prepareApp, renderApp } from '@/test/render_app'

vi.mock('@/lib/tauri', async () => (await import('@/test/fake_tauri_module')).fakeTauriModule)

prepareApp()

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
