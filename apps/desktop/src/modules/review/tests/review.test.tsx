import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { desktop } from '@/test/fake_desktop'
import { prepareApp, renderApp } from '@/test/render_app'

vi.mock('@/lib/tauri', async () => (await import('@/test/fake_tauri_module')).fakeTauriModule)

prepareApp()

const DIFF = [
  'diff --git a/src/a.ts b/src/a.ts',
  '@@ -1,1 +1,2 @@',
  ' keep',
  '+brand new line',
  'diff --git a/src/b.ts b/src/b.ts',
  '@@ -1,1 +1,1 @@',
  '-old',
  '+newer',
].join('\n')

function seededWorkspace(status: 'done' | 'running' = 'done') {
  const web = desktop.addProject('web-store')
  const workspace = desktop.addWorkspace(web, { title: 'Dark mode', status })
  desktop.diffs.set(workspace.identifier, { unifiedDiff: DIFF, wasTruncated: false })
  return workspace
}

describe('review', () => {
  it('lists the changed files and shows the lines of the chosen one', async () => {
    const user = userEvent.setup()
    const workspace = seededWorkspace()
    renderApp(`/workspaces/${workspace.identifier}/changes`)

    expect(await screen.findByText('brand new line')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /src\/b\.ts/ }))

    expect(await screen.findByText('newer')).toBeInTheDocument()
  })

  it('moves a file to the reviewed list when it is marked as viewed and counts progress', async () => {
    const user = userEvent.setup()
    const workspace = seededWorkspace()
    renderApp(`/workspaces/${workspace.identifier}/changes`)
    await screen.findByText('brand new line')

    await user.click(screen.getByRole('checkbox', { name: 'Marcar src/a.ts como visto' }))

    expect(screen.getByText('Revisaste 1 de 2 archivos')).toBeInTheDocument()
    expect(screen.getByText('Revisados · 1')).toBeInTheDocument()
  })

  it('collects line comments in a batch and sends them to the agent as one message', async () => {
    const user = userEvent.setup()
    const workspace = seededWorkspace()
    renderApp(`/workspaces/${workspace.identifier}/changes`)
    await screen.findByText('brand new line')

    await user.click(screen.getByRole('button', { name: 'Comentar la línea 2' }))
    await user.type(screen.getByLabelText('Comentario'), 'Muévelo a la derecha')
    await user.click(screen.getByRole('button', { name: 'Añadir al lote' }))
    expect(screen.getByText('1 comentario en el lote')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Enviar al agente' }))

    await waitFor(() => expect(desktop.called('send_follow_up')).toHaveLength(1))
    expect(desktop.called('send_follow_up')[0]?.prompt).toContain('- src/a.ts:2 — Muévelo a la derecha')
    expect(await screen.findByLabelText('Mensaje para el agente')).toBeInTheDocument()
  })

  it('switches to the side-by-side view', async () => {
    const user = userEvent.setup()
    const workspace = seededWorkspace()
    renderApp(`/workspaces/${workspace.identifier}/changes`)
    await screen.findByText('brand new line')

    await user.click(screen.getByRole('button', { name: 'Dividido' }))

    expect(screen.getByRole('button', { name: 'Dividido' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('brand new line')).toBeInTheDocument()
  })

  it('says so when the agent has not changed anything, and warns when the diff was cut', async () => {
    const web = desktop.addProject('web-store')
    const empty = desktop.addWorkspace(web, { title: 'Empty', status: 'done' })
    renderApp(`/workspaces/${empty.identifier}/changes`)

    expect(await screen.findByText(/aún no ha cambiado ningún archivo/)).toBeInTheDocument()
  })

  it('warns when the diff was cut short', async () => {
    const workspace = seededWorkspace()
    desktop.diffs.set(workspace.identifier, { unifiedDiff: DIFF, wasTruncated: true })
    renderApp(`/workspaces/${workspace.identifier}/changes`)

    expect(await screen.findByText(/Falta parte de los cambios/)).toBeInTheDocument()
  })

  it('does not let a working agent be approved or sent comments', async () => {
    const workspace = seededWorkspace('running')
    renderApp(`/workspaces/${workspace.identifier}/changes`)
    await screen.findByText('brand new line')

    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDisabled()
  })

  it('publishes from the approval panel and shows a refusal with its reason', async () => {
    const user = userEvent.setup()
    const workspace = seededWorkspace()
    desktop.publishFailure = 'La política de gitd rechazó la rama'
    renderApp(`/workspaces/${workspace.identifier}/changes`)
    await screen.findByText('brand new line')

    await user.click(screen.getByRole('button', { name: 'Aprobar' }))
    const panel = await screen.findByRole('dialog')
    await user.click(within(panel).getByRole('button', { name: 'Publicar' }))

    expect(await within(panel).findByRole('alert')).toHaveTextContent('La política de gitd rechazó la rama')
    expect(desktop.called('publish_workspaces')).toEqual([{ workspaceIdentifiers: [workspace.identifier] }])
  })
})
