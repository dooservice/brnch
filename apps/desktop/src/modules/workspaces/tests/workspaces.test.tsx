import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { desktop } from '@/test/fake_desktop'
import { prepareApp, renderApp } from '@/test/render_app'

vi.mock('@/lib/tauri', async () => (await import('@/test/fake_tauri_module')).fakeTauriModule)

prepareApp()

const notice = (workspaceIdentifier: string, sequence: number, event: object) => ({ workspaceIdentifier, sequence, eventJson: JSON.stringify(event) })

describe('workspace agent tab', () => {
  it('shows the history of the agent and then what arrives live, once each', async () => {
    const web = desktop.addProject('web-store')
    const workspace = desktop.addWorkspace(web, { title: 'Add search', status: 'running' })
    desktop.events.set(workspace.identifier, [notice(workspace.identifier, 1, { kind: 'assistant_text', text: 'Reviso el catálogo' })])
    renderApp(`/workspaces/${workspace.identifier}`)
    expect(await screen.findByText('Reviso el catálogo')).toBeInTheDocument()

    act(() => {
      desktop.emitLive(notice(workspace.identifier, 1, { kind: 'assistant_text', text: 'Reviso el catálogo' }))
      desktop.emitLive(notice(workspace.identifier, 2, { kind: 'run_finished', succeeded: true, summary: 'Hecho', cost_in_dollars: 0.12, duration_in_milliseconds: 3000 }))
    })

    expect(await screen.findByText('Hecho')).toBeInTheDocument()
    expect(screen.getAllByText('Reviso el catálogo')).toHaveLength(1)
  })

  it('refreshes the workspace states when a task ends', async () => {
    const web = desktop.addProject('web-store')
    const workspace = desktop.addWorkspace(web, { title: 'Add search', status: 'running' })
    renderApp(`/workspaces/${workspace.identifier}`)
    await screen.findByRole('heading', { name: 'Add search' })
    desktop.workspaces.set(web.identifier, [{ ...workspace, status: 'done' }])

    act(() => desktop.emitLive(notice(workspace.identifier, 1, { kind: 'run_finished', succeeded: true, summary: '', cost_in_dollars: null, duration_in_milliseconds: null })))

    await waitFor(() => expect(screen.getAllByText('Listo para revisar').length).toBeGreaterThan(0))
  })

  it('lets a person continue the conversation only when the agent is not working', async () => {
    const user = userEvent.setup()
    const web = desktop.addProject('web-store')
    const workspace = desktop.addWorkspace(web, { title: 'Add search', status: 'done' })
    renderApp(`/workspaces/${workspace.identifier}`)
    const box = await screen.findByLabelText('Mensaje para el agente')

    await user.type(box, 'ahora añade pruebas')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() => expect(desktop.called('send_follow_up')).toEqual([{ workspaceIdentifier: workspace.identifier, prompt: 'ahora añade pruebas' }]))
  })

  it('blocks the box while the agent works and offers to stop it', async () => {
    const user = userEvent.setup()
    const web = desktop.addProject('web-store')
    const workspace = desktop.addWorkspace(web, { title: 'Add search', status: 'running' })
    renderApp(`/workspaces/${workspace.identifier}`)

    expect(await screen.findByLabelText('Mensaje para el agente')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Detener' }))

    await waitFor(() => expect(desktop.called('stop_run')).toEqual([{ workspaceIdentifier: workspace.identifier }]))
  })

  it('says the isolation is missing in the composer instead of claiming the agent is confined', async () => {
    const web = desktop.addProject('web-store')
    const workspace = desktop.addWorkspace(web, { status: 'done' })
    desktop.sandbox = { available: false, mechanism: 'none', reason: 'no sandbox' }
    renderApp(`/workspaces/${workspace.identifier}`)

    expect(await screen.findByText('Sin confinar')).toBeInTheDocument()
    expect(screen.queryByText('Confinado')).not.toBeInTheDocument()
  })

  it('tells when the workspace does not exist', async () => {
    desktop.addProject('web-store')
    renderApp('/workspaces/nope')

    expect(await screen.findByText('No se encuentra el workspace')).toBeInTheDocument()
  })
})
