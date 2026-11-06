import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { desktop } from '@/test/fake_desktop'
import { prepareApp, renderApp } from '@/test/render_app'

vi.mock('@/lib/tauri', async () => (await import('@/test/fake_tauri_module')).fakeTauriModule)

prepareApp()

describe('shell', () => {
  it('lists every project with its workspaces and their state in the sidebar', async () => {
    const web = desktop.addProject('web-store')
    desktop.addProject('billing-api')
    desktop.addWorkspace(web, { title: 'Fix login', status: 'running' })
    desktop.addWorkspace(web, { title: 'Dark mode', status: 'done' })

    renderApp()

    expect(await screen.findByRole('button', { name: /web-store/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /billing-api/ })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: /Fix login/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Trabajando' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Listo para revisar' })).toBeInTheDocument()
  })

  it('sends a first-time visitor with no projects to the welcome steps', async () => {
    renderApp()

    expect(await screen.findByRole('heading', { name: 'gitd' })).toBeInTheDocument()
  })

  it('adds a project from the dialog: it checks the repository, fills in what it learns and saves the settings', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('brnch.onboarded', '1')
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Añadir proyecto' }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText('URL del repositorio'), 'https://github.com/acme/docs-site')
    expect(await within(dialog).findByText('Repositorio accesible · rama principal main')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Nombre')).toHaveValue('docs-site')
    expect(within(dialog).getByLabelText('Rama base')).toHaveValue('main')
    expect(within(dialog).getByText('Usar la que gitd ya tiene para github.com')).toBeInTheDocument()
    await user.selectOptions(within(dialog).getByLabelText('Rama base'), 'develop')
    await user.type(within(dialog).getByLabelText('Dónde se crean los workspaces'), 'D:\\brnch\\docs-site')
    await user.click(within(dialog).getByRole('button', { name: 'Añadir proyecto' }))

    await waitFor(() => expect(desktop.projects.map(project => project.name)).toEqual(['docs-site']))
    expect(desktop.projects[0]).toMatchObject({ baseBranch: 'develop', workspacesDirectory: 'D:\\brnch\\docs-site' })
    expect(await screen.findByRole('button', { name: /docs-site/ })).toBeInTheDocument()
  })

  it('refuses an address that is not a repository URL and says when the repository does not answer', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('brnch.onboarded', '1')
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Añadir proyecto' }))
    const dialog = await screen.findByRole('dialog')

    await user.type(within(dialog).getByLabelText('URL del repositorio'), 'not a url')
    await user.type(within(dialog).getByLabelText('Nombre'), 'docs-site')
    await user.click(within(dialog).getByRole('button', { name: 'Añadir proyecto' }))
    expect(await within(dialog).findByText(/Usa una URL https o ssh/)).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText('URL del repositorio'))
    await user.type(within(dialog).getByLabelText('URL del repositorio'), 'https://example.com/unreachable')
    expect(await within(dialog).findByText('repository not found')).toBeInTheDocument()
  })

  it('does not open the new project when the person unchecks "open when done"', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('brnch.onboarded', '1')
    renderApp()
    await user.click(await screen.findByRole('button', { name: 'Añadir proyecto' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('URL del repositorio'), 'https://github.com/acme/quiet')
    await within(dialog).findByText(/Repositorio accesible/)

    await user.click(within(dialog).getByLabelText('Abrir el proyecto al terminar'))
    await user.click(within(dialog).getByRole('button', { name: 'Añadir proyecto' }))

    await waitFor(() => expect(desktop.projects).toHaveLength(1))
    expect(desktop.called('activate_project')).toHaveLength(0)
  })

  it('folds the open project when it is clicked again and keeps the others open', async () => {
    const user = userEvent.setup()
    const web = desktop.addProject('web-store')
    desktop.addWorkspace(web, { title: 'Fix login' })
    desktop.active = web.identifier
    renderApp()
    expect(await screen.findByRole('link', { name: /Fix login/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /web-store/ }))

    expect(screen.queryByRole('link', { name: /Fix login/ })).not.toBeInTheDocument()
  })

  it('opens the palette with Ctrl K and jumps to a workspace', async () => {
    const user = userEvent.setup()
    const web = desktop.addProject('web-store')
    const workspace = desktop.addWorkspace(web, { title: 'Dark mode' })
    renderApp()
    await screen.findByRole('link', { name: /Dark mode/ })

    await user.keyboard('{Control>}k{/Control}')
    await user.click(await screen.findByRole('option', { name: /Dark mode/ }))

    expect(await screen.findByRole('heading', { name: 'Dark mode' })).toBeInTheDocument()
    await waitFor(() => expect(desktop.active).toBe(web.identifier))
    expect(workspace.identifier).toBeTruthy()
  })

  it('brings a project back to the page it was left on when it is entered again', async () => {
    const user = userEvent.setup()
    const web = desktop.addProject('web-store')
    const billing = desktop.addProject('billing-api')
    const left = desktop.addWorkspace(web, { title: 'Fix login' })
    desktop.addWorkspace(billing, { title: 'Invoice PDF' })
    desktop.active = billing.identifier
    desktop.layouts.set(web.identifier, JSON.stringify({ path: `/workspaces/${left.identifier}/changes` }))
    renderApp()
    await screen.findByRole('link', { name: /Invoice PDF/ })

    await user.click(screen.getByRole('button', { name: /web-store/ }))

    expect(await screen.findByRole('heading', { name: 'Fix login' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Cambios/ })).toHaveAttribute('aria-current', 'page')
  })

  it('keeps the place of the open workspace so leaving a project can restore it', async () => {
    const user = userEvent.setup()
    const web = desktop.addProject('web-store')
    const workspace = desktop.addWorkspace(web, { title: 'Fix login' })
    desktop.active = web.identifier
    renderApp()

    await user.click(await screen.findByRole('link', { name: /Fix login/ }))

    await waitFor(() => expect(desktop.layouts.get(web.identifier)).toBe(JSON.stringify({ path: `/workspaces/${workspace.identifier}` })))
  })

  it('says whether gitd and the isolation are available', async () => {
    desktop.addProject('web-store')
    desktop.gitd = { connected: false, message: 'no socket' }
    desktop.sandbox = { available: false, mechanism: 'none', reason: 'bubblewrap (bwrap) is not installed' }
    window.localStorage.setItem('brnch.onboarded', '1')
    renderApp()

    expect(await screen.findByText('gitd no disponible')).toBeInTheDocument()
    expect(await screen.findByText('Sin aislamiento: los agentes no se ejecutarán')).toBeInTheDocument()
  })
})
