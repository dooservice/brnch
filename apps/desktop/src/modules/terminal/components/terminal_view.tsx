import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { command, failureText, subscribe } from '@/lib/tauri'
import { decodeBase64, encodeUtf8Base64 } from '../lib/bytes'

interface Attachment {
  terminalIdentifier: string
  backlogBase64: string
}

interface Output {
  terminalIdentifier: string
  dataBase64: string
}

/** The workspace's terminal: one shell kept alive by the app, drawn again when the person returns. */
export default function TerminalView({ workspaceIdentifier }: { workspaceIdentifier: string }) {
  const { t } = useTranslation('terminal')
  const container = useRef<HTMLDivElement>(null)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    const element = container.current
    if (element === null) return
    const terminal = new Terminal({
      fontFamily: '"Geist Mono Variable", ui-monospace, monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: { background: '#0c0c0e', foreground: '#ececef' },
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(element)
    fit.fit()

    let attached: string | null = null
    const waiting: Output[] = []
    let stopListening: (() => void) | null = null
    let disposed = false

    const show = (output: Output) => terminal.write(decodeBase64(output.dataBase64))
    subscribe<Output>('terminal-output', output => {
      if (attached === null) waiting.push(output)
      else if (output.terminalIdentifier === attached) show(output)
    }).then(stop => {
      if (disposed) stop()
      else stopListening = stop
    })

    command<Attachment>('open_terminal', { workspaceIdentifier, rows: terminal.rows, columns: terminal.cols })
      .then(attachment => {
        if (disposed) return
        attached = attachment.terminalIdentifier
        terminal.write(decodeBase64(attachment.backlogBase64))
        waiting.filter(output => output.terminalIdentifier === attached).forEach(show)
        waiting.length = 0
        terminal.focus()
      })
      .catch((error: unknown) => !disposed && setFailure(failureText(error)))

    const typing = terminal.onData(data => {
      void command('write_terminal', { workspaceIdentifier, dataBase64: encodeUtf8Base64(data) })
    })
    const observer = new ResizeObserver(() => {
      fit.fit()
      void command('resize_terminal', { workspaceIdentifier, rows: terminal.rows, columns: terminal.cols }).catch(() => undefined)
    })
    observer.observe(element)

    return () => {
      disposed = true
      observer.disconnect()
      typing.dispose()
      stopListening?.()
      terminal.dispose()
    }
  }, [workspaceIdentifier])

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      {failure && <p role="alert" className="border-b border-line px-4 py-2 text-danger">{t('failed', { reason: failure })}</p>}
      <div ref={container} aria-label={t('label')} className="min-h-0 flex-1 p-2" />
    </div>
  )
}
