import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { desktop } from '@/test/fake_desktop'
import { prepareApp, renderApp } from '@/test/render_app'

vi.mock('@/lib/tauri', async () => (await import('@/test/fake_tauri_module')).fakeTauriModule)

const typed: string[] = []
const written: string[] = []

// xterm draws on a canvas, which jsdom does not have; the screen only needs its small surface.
vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    rows = 24
    cols = 80
    loadAddon() {}
    open() {}
    focus() {}
    dispose() {}
    write(data: Uint8Array) {
      written.push(new TextDecoder().decode(data))
    }
    onData(listener: (data: string) => void) {
      typed.push('listening')
      listener('ls\r')
      return { dispose() {} }
    }
  },
}))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} } }))

prepareApp()

describe('terminal tab', () => {
  it('opens the workspace terminal, draws its history and sends what is typed', async () => {
    const web = desktop.addProject('web-store')
    const workspace = desktop.addWorkspace(web, { title: 'Add search' })
    desktop.terminalBacklog = btoa('$ previous output')
    renderApp(`/workspaces/${workspace.identifier}/terminal`)

    expect(await screen.findByLabelText('Terminal del workspace')).toBeInTheDocument()
    await waitFor(() => expect(written).toContain('$ previous output'))
    await waitFor(() => expect(desktop.called('write_terminal')).toEqual([{ workspaceIdentifier: workspace.identifier, dataBase64: btoa('ls\r') }]))
    expect(desktop.called('open_terminal')[0]).toMatchObject({ workspaceIdentifier: workspace.identifier })
  })

  it('shows why the terminal could not be opened', async () => {
    const web = desktop.addProject('web-store')
    const workspace = desktop.addWorkspace(web, { title: 'Add search' })
    desktop.terminalFailure = 'no shell'
    renderApp(`/workspaces/${workspace.identifier}/terminal`)

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo abrir la terminal: no shell')
  })
})
