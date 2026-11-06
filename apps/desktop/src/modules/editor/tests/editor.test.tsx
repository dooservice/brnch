import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { desktop } from '@/test/fake_desktop'
import { prepareApp, renderApp } from '@/test/render_app'
import { openFilesStore } from '@/modules/editor/lib/open_files'

vi.mock('@/lib/tauri', async () => (await import('@/test/fake_tauri_module')).fakeTauriModule)

interface Fake {
  options: { document: string; onChange: (text: string) => void; onSave: () => void; onCursor: (line: number, column: number) => void }
  text: string
  line: number | null
}
const editors: Fake[] = []

// CodeMirror measures real layout, which jsdom does not have; the screen only needs this small surface.
vi.mock('@/modules/editor/lib/create_editor', () => ({
  createEditor: (options: Fake['options']) => {
    const fake: Fake = { options, text: options.document, line: null }
    editors.push(fake)
    return { getText: () => fake.text, goToLine: (line: number) => { fake.line = line }, setLanguage: () => {}, destroy: () => {} }
  },
}))
vi.mock('@/modules/editor/lib/language_for', () => ({ loadLanguage: async () => null, languageName: (path: string) => (path.endsWith('.tsx') ? 'TypeScript React' : null) }))

prepareApp()
beforeEach(() => {
  editors.length = 0
  openFilesStore.reset()
  window.localStorage.clear()
})

function seeded() {
  const web = desktop.addProject('web-store')
  const workspace = desktop.addWorkspace(web, { title: 'Add search', status: 'done' })
  desktop.files.set('README.md', '# Title\nsearch me\n')
  desktop.files.set('src/catalog/SearchBox.tsx', 'export const box = 1\n// search box\n')
  desktop.files.set('src/main.ts', 'main\n')
  desktop.files.set('logo.bin', '\u0000binary')
  return workspace
}

describe('files tab', () => {
  it('opens a file from the tree into a tab and shows its language and cursor', async () => {
    const user = userEvent.setup()
    const workspace = seeded()
    renderApp(`/workspaces/${workspace.identifier}/files`)

    await user.click(await screen.findByRole('button', { name: /src/ }))
    await user.click(await screen.findByRole('button', { name: /catalog/ }))
    await user.click(await screen.findByRole('button', { name: /SearchBox\.tsx/ }))

    expect(await screen.findByLabelText('Editor de src/catalog/SearchBox.tsx')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /SearchBox\.tsx/ })).toHaveAttribute('aria-selected', 'true')
    act(() => editors.at(-1)?.options.onCursor(2, 4))
    expect(await screen.findByText('Ln 2, Col 4')).toBeInTheDocument()
    expect(screen.getByText('TypeScript React')).toBeInTheDocument()
  })

  it('marks unsaved changes and writes the file with Ctrl+S', async () => {
    const user = userEvent.setup()
    const workspace = seeded()
    renderApp(`/workspaces/${workspace.identifier}/files`)
    await user.click(await screen.findByRole('button', { name: 'README.md' }))
    await screen.findByLabelText('Editor de README.md')

    act(() => {
      const editor = editors.at(-1)!
      editor.text = '# Changed\n'
      editor.options.onChange(editor.text)
    })
    expect(await screen.findByLabelText('Cambios sin guardar')).toBeInTheDocument()
    act(() => editors.at(-1)?.options.onSave())

    await waitFor(() => expect(desktop.files.get('README.md')).toBe('# Changed\n'))
    await waitFor(() => expect(screen.queryByLabelText('Cambios sin guardar')).not.toBeInTheDocument())
  })

  it('keeps what was typed when another tab is shown and comes back to it', async () => {
    const user = userEvent.setup()
    const workspace = seeded()
    renderApp(`/workspaces/${workspace.identifier}/files`)
    await user.click(await screen.findByRole('button', { name: 'README.md' }))
    await screen.findByLabelText('Editor de README.md')
    act(() => {
      const editor = editors.at(-1)!
      editor.text = 'draft text'
      editor.options.onChange('draft text')
    })
    await user.click(screen.getByRole('button', { name: /src/ }))
    await user.click(await screen.findByRole('button', { name: 'main.ts' }))
    await screen.findByLabelText('Editor de src/main.ts')

    await user.click(screen.getByRole('tab', { name: /README\.md/ }))

    await screen.findByLabelText('Editor de README.md')
    expect(editors.at(-1)?.options.document).toBe('draft text')
  })

  it('finds a file by name and opens it, and brings a search hit into view at its line', async () => {
    const user = userEvent.setup()
    const workspace = seeded()
    renderApp(`/workspaces/${workspace.identifier}/files`)

    await user.type(await screen.findByLabelText('Ir a archivo'), 'searchbox')
    await user.click(await screen.findByRole('button', { name: 'src/catalog/SearchBox.tsx' }))
    await screen.findByLabelText('Editor de src/catalog/SearchBox.tsx')
    await user.type(screen.getByLabelText('Buscar en el proyecto'), 'search me')
    const panel = await screen.findByLabelText('Buscar en el workspace')
    await user.click(await within(panel).findByRole('button', { name: /2\s+search me/ }))

    await screen.findByLabelText('Editor de README.md')
    await waitFor(() => expect(editors.at(-1)?.line).toBe(2))
  })

  it('says a binary file cannot be edited, and restores the tabs after a restart', async () => {
    const user = userEvent.setup()
    const workspace = seeded()
    renderApp(`/workspaces/${workspace.identifier}/files`)
    await user.click(await screen.findByRole('button', { name: 'logo.bin' }))
    expect(await screen.findByText('Archivo binario: no se puede editar aquí.')).toBeInTheDocument()

    openFilesStore.reset()
    renderApp(`/workspaces/${workspace.identifier}/files`)

    expect((await screen.findAllByRole('tab', { name: /logo\.bin/ })).length).toBeGreaterThan(0)
  })
})
