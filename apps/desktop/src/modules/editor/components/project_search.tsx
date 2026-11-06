import { FileIcon, SearchIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDebouncedValue } from '@/hooks/use_debounced_value'
import { useFindText } from '../api/use_files'
import type { TextMatch } from '../types/editor.types'

/** Search in the whole workspace: matching lines grouped by file. */
export default function ProjectSearch({ workspaceIdentifier, onOpen }: { workspaceIdentifier: string; onOpen: (path: string, line: number) => void }) {
  const { t } = useTranslation('editor')
  const [query, setQuery] = useState('')
  const settled = useDebouncedValue(query.trim(), 300)
  const results = useFindText(workspaceIdentifier, settled)
  const matches = results.data ?? []
  const byFile = new Map<string, TextMatch[]>()
  matches.forEach(match => byFile.set(match.relativePath, [...(byFile.get(match.relativePath) ?? []), match]))

  return (
    <aside aria-label={t('searchLabel')} className="flex w-72 shrink-0 flex-col gap-2.5 border-l border-line bg-side p-3">
      <h2 className="font-semibold">{t('searchTitle')}</h2>
      <label className="flex h-7 items-center gap-2 rounded-md border border-line px-2 text-muted">
        <SearchIcon size={13} />
        <input value={query} onChange={event => setQuery(event.target.value)} aria-label={t('searchTitle')} className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-ink outline-none" />
      </label>
      {settled !== '' && !results.isPending && <p className="text-[12px] text-muted">{t('searchCount', { count: matches.length, files: byFile.size })}</p>}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto text-[12px]">
        {[...byFile.entries()].map(([path, hits]) => (
          <div key={path}>
            <p className="flex items-center gap-1.5 font-mono"><FileIcon size={12} className="text-muted" />{path}</p>
            {hits.map(hit => (
              <button key={`${hit.line}-${hit.text}`} type="button" onClick={() => onOpen(path, hit.line)} className="block w-full truncate rounded px-5 py-0.5 text-left font-mono text-muted hover:bg-hover hover:text-ink">{hit.line}  {hit.text}</button>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
