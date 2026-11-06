import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { failureText } from '@/lib/tauri'
import { useFile } from '../api/use_files'
import { createEditor } from '../lib/create_editor'
import type { EditorHandle } from '../lib/create_editor'
import { loadLanguage } from '../lib/language_for'

interface EditorPaneProps {
  workspaceIdentifier: string
  path: string
  /** What was typed and not saved yet, if anything. */
  draft: string | undefined
  /** A line to bring into view once the file is shown. */
  goToLine: number | null
  onChange: (text: string, saved: string) => void
  onSave: (text: string) => void
  onCursor: (line: number, column: number) => void
}

/** One file in the editor. It is built again when another file is shown. */
export default function EditorPane({ workspaceIdentifier, path, draft, goToLine, onChange, onSave, onCursor }: EditorPaneProps) {
  const { t } = useTranslation('editor')
  const file = useFile(workspaceIdentifier, path)
  const container = useRef<HTMLDivElement>(null)
  const handle = useRef<EditorHandle | null>(null)
  const saved = file.data?.content ?? ''
  const callbacks = useRef({ onChange, onSave, onCursor })
  useEffect(() => {
    callbacks.current = { onChange, onSave, onCursor }
  })

  useEffect(() => {
    const parent = container.current
    if (parent === null || file.data === undefined || file.data.isBinary || file.data.isTooLarge) return
    let cancelled = false
    const editor = createEditor({
      parent,
      document: draft ?? file.data.content,
      onChange: text => callbacks.current.onChange(text, file.data?.content ?? ''),
      onSave: () => callbacks.current.onSave(editor.getText()),
      onCursor: (line, column) => callbacks.current.onCursor(line, column),
    })
    handle.current = editor
    void loadLanguage(path).then(extension => {
      if (!cancelled && extension !== null) editor.setLanguage(extension)
    })
    return () => {
      cancelled = true
      editor.destroy()
      handle.current = null
    }
    // The editor is rebuilt for another file or for fresh content, never for typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, saved, file.data?.isBinary, file.data?.isTooLarge])

  useEffect(() => {
    if (goToLine !== null) handle.current?.goToLine(goToLine)
  }, [goToLine, saved])

  if (file.isPending) return <p className="m-auto text-muted">{t('loading')}</p>
  if (file.isError) return <p role="alert" className="m-auto max-w-120 text-center text-danger">{failureText(file.error)}</p>
  if (file.data.isBinary) return <p className="m-auto text-muted">{t('binary')}</p>
  if (file.data.isTooLarge) return <p className="m-auto text-muted">{t('tooLarge')}</p>
  return <div ref={container} aria-label={t('editorOf', { path })} className="min-h-0 flex-1 overflow-hidden" />
}
