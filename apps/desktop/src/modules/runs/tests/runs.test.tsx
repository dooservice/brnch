import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { desktop } from '@/test/fake_desktop'
import { prepareApp, renderApp } from '@/test/render_app'

vi.mock('@/lib/tauri', async () => (await import('@/test/fake_tauri_module')).fakeTauriModule)

prepareApp()

describe('new run', () => {
  async function openDialog() {
    const user = userEvent.setup()
    const web = desktop.addProject('web-store')
    desktop.active = web.identifier
    renderApp('/')
    await screen.findByRole('button', { name: /web-store/ })
    await user.click(await screen.findByRole('button', { name: 'Nueva corrida' }))
    return { user, dialog: await screen.findByRole('dialog') }
  }

  it('starts the chosen number of copies with a name taken from the task and the chosen mode', async () => {
    const { user, dialog } = await openDialog()
    await user.type(within(dialog).getByLabelText('Tarea'), 'Añade una búsqueda por nombre al catálogo con pruebas')
    await user.click(within(dialog).getByRole('button', { name: 'Más copias' }))
    await user.click(within(dialog).getByRole('radio', { name: 'Solo plan' }))
    await user.type(within(dialog).getByLabelText('Rama base'), 'develop')

    await user.click(within(dialog).getByRole('button', { name: 'Lanzar 2 agentes' }))

    await waitFor(() => expect(desktop.called('start_run')).toHaveLength(1))
    expect(desktop.called('start_run')[0]?.request).toMatchObject({
      runLabel: 'Añade una búsqueda por nombre al',
      agentKind: 'claude_code',
      permissionMode: 'plan_only',
      baseBranch: 'develop',
      copies: 2,
    })
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('asks for the task before starting anything', async () => {
    const { user, dialog } = await openDialog()

    await user.click(within(dialog).getByRole('button', { name: 'Lanzar 1 agente' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Describe la tarea')
    expect(desktop.called('start_run')).toHaveLength(0)
  })

  it('warns when Claude Code is not installed', async () => {
    desktop.agents = [{ kind: 'claude_code', installed: false, version: null }]
    const { dialog } = await openDialog()

    expect(await within(dialog).findByText('No se encontró Claude Code en este equipo.')).toBeInTheDocument()
  })
})

describe('run comparison', () => {
  function seededRun() {
    const web = desktop.addProject('web-store')
    desktop.active = web.identifier
    const first = desktop.addWorkspace(web, { title: 'Add search', branchName: 'agents/add-search', status: 'done', runIdentifier: 'run-1', costInDollars: 0.31 })
    const second = desktop.addWorkspace(web, { title: 'Add search', branchName: 'agents/add-search-2', status: 'done', runIdentifier: 'run-1', costInDollars: 0.42 })
    const third = desktop.addWorkspace(web, { title: 'Add search', branchName: 'agents/add-search-3', status: 'done', runIdentifier: 'run-1', costInDollars: 0.55 })
    return { first, second, third }
  }

  it('recommends the cheapest agent that clashes with nobody and shows who clashes', async () => {
    const { first, third } = seededRun()
    desktop.conflicts = [{ firstWorkspaceIdentifier: first.identifier, secondWorkspaceIdentifier: third.identifier, clashingPaths: ['src/Header.tsx'] }]
    renderApp('/runs/run-1')

    expect(await screen.findByText(/Publica agents\/add-search-2/)).toBeInTheDocument()
    expect(await screen.findByText(/chocan en: src\/Header\.tsx/)).toBeInTheDocument()
    expect(screen.getAllByText('Ninguno')).toHaveLength(1)
  })

  it('publishes the selected branches through the panel', async () => {
    const user = userEvent.setup()
    const { first, second } = seededRun()
    renderApp('/runs/run-1')

    await user.click(await screen.findByRole('checkbox', { name: 'Seleccionar agents/add-search' }))
    await user.click(screen.getByRole('checkbox', { name: 'Seleccionar agents/add-search-2' }))
    await user.click(screen.getByRole('button', { name: 'Publicar 2 seleccionados' }))
    const panel = await screen.findByRole('dialog')
    await user.click(within(panel).getByRole('button', { name: 'Publicar' }))

    await waitFor(() => expect(desktop.called('publish_workspaces')).toHaveLength(1))
    expect(desktop.called('publish_workspaces')[0]?.workspaceIdentifiers).toEqual([first.identifier, second.identifier])
  })

  it('recommends nothing while no agent has finished well', async () => {
    const web = desktop.addProject('web-store')
    desktop.addWorkspace(web, { branchName: 'agents/a', status: 'running', runIdentifier: 'run-9' })
    desktop.addWorkspace(web, { branchName: 'agents/b', status: 'failed', runIdentifier: 'run-9' })
    renderApp('/runs/run-9')

    expect(await screen.findByText(/Ninguna rama cumple todavía/)).toBeInTheDocument()
  })
})
