import { ChevronDownIcon, ChevronRightIcon, FileIcon, FolderIcon, SearchIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Kbd from '@/components/kbd'
import { cn } from '@/lib/utils'
import type { FileChangeStatus } from '@/lib/unified_diff'
import { useDirectory, useFindFiles } from '../api/use_files'

interface FileTreeProps {
  workspaceIdentifier: string
  activePath: string | null
  changes: ReadonlyMap<string, FileChangeStatus>
  onOpen: (path: string) => void
}

/** The files of a workspace: folders open on demand, changed files marked, and a quick search. */
export default function FileTree({ workspaceIdentifier, activePath, changes, onOpen }: FileTreeProps) {
  const { t } = useTranslation('editor')
  const [query, setQuery] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const found = useFindFiles(workspaceIdentifier, query)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex w-60 shrink-0 flex-col border-r border-line bg-side py-2">
      <label className="mx-2 mb-1.5 flex h-7 items-center gap-2 rounded-md border border-line px-2 text-muted">
        <SearchIcon size={13} />
        <input ref={input} value={query} onChange={event => setQuery(event.target.value)} aria-label={t('goToFile')} placeholder={t('goToFile')} className="min-w-0 flex-1 bg-transparent text-ink outline-none" />
        <Kbd>Ctrl P</Kbd>
      </label>
      <div className="flex-1 overflow-y-auto">
        {query.trim() !== '' ? (
          <ul aria-label={t('results')}>
            {(found.data ?? []).map(path => (
              <li key={path}><button type="button" onClick={() => { onOpen(path); setQuery('') }} className="block w-full truncate px-3 py-1 text-left font-mono text-[12px] hover:bg-hover">{path}</button></li>
            ))}
            {found.data?.length === 0 && <li className="px-3 py-2 text-muted">{t('noFiles')}</li>}
          </ul>
        ) : (
          <TreeLevel workspaceIdentifier={workspaceIdentifier} folder="" depth={0} activePath={activePath} changes={changes} onOpen={onOpen} />
        )}
      </div>
    </div>
  )
}

interface TreeLevelProps extends Omit<FileTreeProps, 'onOpen'> {
  folder: string
  depth: number
  onOpen: (path: string) => void
}

function TreeLevel({ workspaceIdentifier, folder, depth, activePath, changes, onOpen }: TreeLevelProps) {
  const { data: entries = [] } = useDirectory(workspaceIdentifier, folder)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const toggle = (path: string) => {
    const next = new Set(expanded)
    if (!next.delete(path)) next.add(path)
    setExpanded(next)
  }
  const indent = { paddingLeft: `${8 + depth * 14}px` }

  return (
    <ul>
      {entries.map(entry => {
        const status = changes.get(entry.relativePath)
        return (
          <li key={entry.relativePath}>
            {entry.isDirectory ? (
              <>
                <button type="button" aria-expanded={expanded.has(entry.relativePath)} onClick={() => toggle(entry.relativePath)} style={indent} className="mx-1.5 flex w-[calc(100%-12px)] items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[12.5px] text-[#c4c4cc] hover:bg-hover">
                  {expanded.has(entry.relativePath) ? <ChevronDownIcon size={13} className="text-muted" /> : <ChevronRightIcon size={13} className="text-muted" />}
                  <FolderIcon size={13} className="text-muted" />{entry.name}
                </button>
                {expanded.has(entry.relativePath) && <TreeLevel workspaceIdentifier={workspaceIdentifier} folder={entry.relativePath} depth={depth + 1} activePath={activePath} changes={changes} onOpen={onOpen} />}
              </>
            ) : (
              <button type="button" aria-current={entry.relativePath === activePath} onClick={() => onOpen(entry.relativePath)} style={{ paddingLeft: `${22 + depth * 14}px` }} className={cn('mx-1.5 flex w-[calc(100%-12px)] items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[12.5px] hover:bg-hover', entry.relativePath === activePath ? 'bg-hover text-ink' : 'text-[#c4c4cc]')}>
                <FileIcon size={13} className="text-muted" />
                <span className="flex-1 truncate">{entry.name}</span>
                {status && <span className={cn('text-[11px]', status === 'added' ? 'text-ok' : status === 'deleted' ? 'text-danger' : 'text-warn')}>{status === 'added' ? 'N' : status === 'deleted' ? 'D' : 'M'}</span>}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
