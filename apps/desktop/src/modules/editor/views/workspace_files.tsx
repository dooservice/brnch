import { ChevronRightIcon, FileIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { failureText } from '@/lib/tauri'
import { parseUnifiedDiff } from '@/lib/unified_diff'
import type { FileChangeStatus } from '@/lib/unified_diff'
import { cn } from '@/lib/utils'
import { WorkspaceLayout, useWorkspace, useWorkspaceDiff } from '@/modules/workspaces'
import { useSaveFile } from '@/modules/editor/api/use_files'
import EditorPane from '@/modules/editor/components/editor_pane'
import FileTree from '@/modules/editor/components/file_tree'
import ProjectSearch from '@/modules/editor/components/project_search'
import { languageName } from '@/modules/editor/lib/language_for'
import { useOpenFiles } from '@/modules/editor/lib/open_files'

/** The Archivos tab: tree, tabs with the open files, the editor and a search over the workspace. */
export default function WorkspaceFiles() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { workspace } = useWorkspace(workspaceId)
  return (
    <WorkspaceLayout workspaceIdentifier={workspaceId}>
      {workspace !== null && <FilesBody key={workspace.identifier} workspaceIdentifier={workspace.identifier} status={workspace.status} />}
    </WorkspaceLayout>
  )
}

function FilesBody({ workspaceIdentifier, status }: { workspaceIdentifier: string; status: string }) {
  const { t } = useTranslation('editor')
  const { files, store } = useOpenFiles(workspaceIdentifier)
  const diff = useWorkspaceDiff(workspaceIdentifier, status)
  const save = useSaveFile(workspaceIdentifier)
  const [drafts, setDrafts] = useState<ReadonlyMap<string, string>>(new Map())
  const [target, setTarget] = useState<{ path: string; line: number } | null>(null)
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const changes = new Map<string, FileChangeStatus>((diff.data ? parseUnifiedDiff(diff.data.unifiedDiff) : []).map(file => [file.path, file.status]))
  const active = files.active

  const setDraft = (path: string, text: string | undefined) => {
    const next = new Map(drafts)
    if (text === undefined) next.delete(path)
    else next.set(path, text)
    setDrafts(next)
  }
  const saveFile = async (path: string, text: string) => {
    await save.mutateAsync({ relativePath: path, content: text })
    setDraft(path, undefined)
  }
  const openAt = (path: string, line: number) => {
    store.open(workspaceIdentifier, path)
    setTarget({ path, line })
  }
  const closeTab = (path: string) => {
    setDraft(path, undefined)
    store.close(workspaceIdentifier, path)
  }

  return (
    <div className="flex min-h-0 flex-1">
      <FileTree workspaceIdentifier={workspaceIdentifier} activePath={active} changes={changes} onOpen={path => store.open(workspaceIdentifier, path)} />
      <div className="flex min-w-0 flex-1 flex-col">
        {files.paths.length === 0 ? (
          <p className="m-auto text-muted">{t('nothingOpen')}</p>
        ) : (
          <>
            <div role="tablist" className="flex border-b border-line bg-side">
              {files.paths.map(path => (
                <div key={path} role="presentation" className={cn('flex h-8.5 items-center gap-2 border-r border-line pr-2 pl-3.5', path === active ? 'bg-canvas text-ink shadow-[inset_0_-2px_0_var(--color-info)]' : 'text-muted')}>
                  <button type="button" role="tab" aria-selected={path === active} onClick={() => store.activate(workspaceIdentifier, path)} className="flex items-center gap-2">
                    <FileIcon size={13} />{path.split('/').pop()}{drafts.has(path) && <span aria-label={t('unsaved')} className="text-warn">●</span>}
                  </button>
                  <button type="button" aria-label={t('closeFile', { path })} onClick={() => closeTab(path)} className="text-muted hover:text-ink"><XIcon size={13} /></button>
                </div>
              ))}
            </div>
            {active !== null && (
              <>
                <div className="flex items-center gap-1.5 border-b border-line px-4 py-1.5 text-[12px] text-muted">
                  {active.split('/').map((part, index, parts) => (
                    <span key={`${part}-${index}`} className="flex items-center gap-1.5">{index > 0 && <ChevronRightIcon size={12} />}<span className={index === parts.length - 1 ? 'text-ink' : ''}>{part}</span></span>
                  ))}
                </div>
                <EditorPane
                  key={active}
                  workspaceIdentifier={workspaceIdentifier}
                  path={active}
                  draft={drafts.get(active)}
                  goToLine={target?.path === active ? target.line : null}
                  onChange={(text, savedText) => setDraft(active, text === savedText ? undefined : text)}
                  onSave={text => void saveFile(active, text)}
                  onCursor={(line, column) => setCursor({ line, column })}
                />
                <div className="flex h-6 items-center gap-4 border-t border-line bg-side px-3 font-mono text-[11.5px] text-muted">
                  {save.isError && <span role="alert" className="font-sans text-danger">{failureText(save.error)}</span>}
                  <span className="flex-1" />
                  <span>{t('cursor', { line: cursor.line, column: cursor.column })}</span>
                  <span className="font-sans">{languageName(active) ?? t('plainText')}</span>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <ProjectSearch workspaceIdentifier={workspaceIdentifier} onOpen={openAt} />
    </div>
  )
}
