import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { Compartment, EditorState } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view'

export interface EditorOptions {
  parent: HTMLElement
  document: string
  onChange: (text: string) => void
  onSave: () => void
  onCursor: (line: number, column: number) => void
}

export interface EditorHandle {
  getText: () => string
  goToLine: (line: number) => void
  setLanguage: (extension: Extension) => void
  destroy: () => void
}

/** Builds a CodeMirror editor with the app's look; the rest of the code never sees CodeMirror. */
export function createEditor(options: EditorOptions): EditorHandle {
  const language = new Compartment()
  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.document,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        oneDark,
        EditorView.theme({ '&': { height: '100%', backgroundColor: '#0c0c0e' }, '.cm-gutters': { backgroundColor: '#0c0c0e', border: 'none' }, '.cm-scroller': { fontFamily: '"Geist Mono Variable", ui-monospace, monospace', fontSize: '13px' } }),
        keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => { options.onSave(); return true } }, indentWithTab, ...defaultKeymap, ...historyKeymap]),
        language.of([]),
        EditorView.updateListener.of(update => {
          if (update.docChanged) options.onChange(update.state.doc.toString())
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head
            const line = update.state.doc.lineAt(head)
            options.onCursor(line.number, head - line.from + 1)
          }
        }),
      ],
    }),
  })
  return {
    getText: () => view.state.doc.toString(),
    goToLine: lineNumber => {
      const line = view.state.doc.line(Math.min(Math.max(lineNumber, 1), view.state.doc.lines))
      view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true })
      view.focus()
    },
    setLanguage: extension => view.dispatch({ effects: language.reconfigure(extension) }),
    destroy: () => view.destroy(),
  }
}
