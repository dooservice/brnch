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
    desktop.addProject('billing-api')
    desktop.active = web.identifier
    renderApp('/')
    await screen.findByRole('button', { name: /web-store/ })
    await user.click(await screen.findByRole('button', { name: 'Nueva corrida' }))
    return { user, dialog: await screen.findByRole('dialog'), web }
  }

  it('starts the chosen copies with a name taken from the task, the chosen mode, branch and time limit', async () => {
    const { user, dialog, web } = await openDialog()
    await user.type(within(dialog).getByLabelText('Tarea'), 'Añade una búsqueda por nombre al catálogo con pruebas')
    await user.click(within(dialog).getByRole('button', { name: 'Más copias' }))
    await user.click(within(dialog).getByRole('radio', { name: 'Solo plan' }))
    await user.selectOptions(await within(dialog).findByLabelText('Rama base'), 'develop')
    await user.click(within(dialog).getByRole('button', { name: /Opciones avanzadas/ }))
    await user.type(within(dialog).getByLabelText('Tiempo máximo (minutos)'), '30')

    await user.click(within(dialog).getByRole('button', { name: /Lanzar 2 agentes/ }))

    await waitFor(() => expect(desktop.called('start_run')).toHaveLength(1))
    expect(desktop.called('start_run')[0]?.request).toMatchObject({
      projectIdentifier: web.identifier,
      runLabel: 'Añade una búsqueda por nombre al',
      agentKind: 'claude_code',
      permissionMode: 'plan_only',
      baseBranch: 'develop',
      copies: 2,
      maximumMinutes: 30,
    })
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('lets the person run the task in another project and starts from that project', async () => {
    const { user, dialog } = await openDialog()
    await user.selectOptions(within(dialog).getByLabelText('Proyecto'), 'billing-api')
    await user.type(within(dialog).getByLabelText('Tarea'), 'Corrige el redondeo')

    await user.click(within(dialog).getByRole('button', { name: /Lanzar 1 agente/ }))

    await waitFor(() => expect(desktop.called('start_run')).toHaveLength(1))
    expect(desktop.called('start_run')[0]?.request).toMatchObject({ projectIdentifier: desktop.projects[1]?.identifier })
  })

  it('shows the agents of the design: Claude Code to use and the others as not available yet', async () => {
    const { dialog } = await openDialog()

    expect(await within(dialog).findByText('Instalado 2.1.0')).toBeInTheDocument()
    for (const name of ['Codex', 'Gemini CLI', 'OpenCode']) expect(within(dialog).getByText(name)).toBeInTheDocument()
    expect(within(dialog).getAllByRole('button', { name: 'Próximamente' })).toHaveLength(3)
    expect(within(dialog).getByText('agents/')).toBeInTheDocument()
  })

  it('asks for the task before starting anything', async () => {
    const { user, dialog } = await openDialog()

    await user.click(within(dialog).getByRole('button', { name: /Lanzar 1 agente/ }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Describe la tarea')
    expect(desktop.called('start_run')).toHaveLength(0)
  })

  it('refuses a time limit that is not a whole number of minutes', async () => {
    const { user, dialog } = await openDialog()
    await user.type(within(dialog).getByLabelText('Tarea'), 'algo')
    await user.click(within(dialog).getByRole('button', { name: /Opciones avanzadas/ }))
    await user.type(within(dialog).getByLabelText('Tiempo máximo (minutos)'), 'abc')

    await user.click(within(dialog).getByRole('button', { name: /Lanzar 1 agente/ }))

    expect(await within(dialog).findByText(/número entero de minutos/)).toBeInTheDocument()
    expect(desktop.called('start_run')).toHaveLength(0)
  })

  it('warns that nothing will start when there is no isolation', async () => {
    desktop.sandbox = { available: false, mechanism: 'none', reason: 'no sandbox' }
    const { dialog } = await openDialog()

    expect(await within(dialog).findByText('Sin aislamiento: los agentes no arrancarán')).toBeInTheDocument()
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
