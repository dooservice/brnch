import { CircleCheckIcon, FileTextIcon, TriangleAlertIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { parseUnifiedDiff } from '@/lib/unified_diff'
import { useProjectConflicts, useWorkspaceDiff } from '../api/use_workspace_review_data'
import type { Workspace } from '../types/workspace.types'

interface SidePanelProps {
  workspace: Workspace
  projectIdentifier: string
  siblings: Workspace[]
}

/** Beside the conversation: what changed so far, what gitd says about clashes and the session. */
export default function SidePanel({ workspace, projectIdentifier, siblings }: SidePanelProps) {
  const { t } = useTranslation('workspaces')
  const navigate = useNavigate()
  const diff = useWorkspaceDiff(workspace.identifier, workspace.status)
  const canCompare = siblings.length >= 2
  const fingerprint = siblings.map(sibling => `${sibling.identifier}:${sibling.status}`).join(',')
  const conflicts = useProjectConflicts(projectIdentifier, fingerprint, canCompare)

  const files = diff.data ? parseUnifiedDiff(diff.data.unifiedDiff) : null
  const added = files?.reduce((sum, file) => sum + file.added, 0) ?? 0
  const removed = files?.reduce((sum, file) => sum + file.removed, 0) ?? 0
  const clashes = conflicts.data?.filter(conflict => conflict.firstWorkspaceIdentifier === workspace.identifier || conflict.secondWorkspaceIdentifier === workspace.identifier).length ?? null
  const row = 'flex items-center justify-between gap-3 py-0.5'

  return (
    <aside aria-label={t('panel.label')} className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-line bg-side">
      <section className="flex flex-col gap-2 border-b border-line px-3.5 py-3">
        <h2 className="flex items-center justify-between font-semibold">{t('panel.changes')}<span className="font-mono text-[12px] font-normal"><span className="text-ok">+{added}</span> <span className="text-danger">−{removed}</span></span></h2>
        {files === null && <p className="text-muted">{diff.isError ? '—' : t('panel.loading')}</p>}
        {files?.length === 0 && <p className="text-muted">{t('panel.noChanges')}</p>}
        {files?.map(file => (
          <button key={file.path} type="button" onClick={() => navigate(`/workspaces/${workspace.identifier}/changes`)} className="flex items-center gap-2 py-0.5 text-left hover:text-ink">
            <FileTextIcon size={14} className="shrink-0 text-muted" />
            <span className="flex-1 truncate font-mono text-[12px]">{file.path}</span>
          </button>
        ))}
      </section>
      <section className="flex flex-col gap-2 border-b border-line px-3.5 py-3">
        <h2 className="font-semibold">{t('panel.gitdChecks')}</h2>
        {!canCompare && <p className="text-muted">{t('panel.aloneNoCompare')}</p>}
        {canCompare && clashes === null && <p className="text-muted">{t('panel.loading')}</p>}
        {clashes === 0 && <p className="flex items-center gap-2"><CircleCheckIcon size={14} className="text-ok" />{t('panel.noClashes')}</p>}
        {clashes !== null && clashes > 0 && <p className="flex items-center gap-2 text-danger"><TriangleAlertIcon size={14} />{t('panel.clashes', { count: clashes })}</p>}
      </section>
      <section className="flex flex-col gap-1 px-3.5 py-3">
        <h2 className="font-semibold">{t('panel.session')}</h2>
        <div className={row}><span className="text-muted">{t('panel.agent')}</span><span>{workspace.agentLabel || '—'}</span></div>
        <div className={row}><span className="text-muted">{t('panel.state')}</span><span>{t(`status.${workspace.status}`)}</span></div>
        {workspace.durationInMilliseconds !== null && <div className={row}><span className="text-muted">{t('panel.duration')}</span><span className="font-mono">{(workspace.durationInMilliseconds / 1000).toFixed(1)} s</span></div>}
        {workspace.costInDollars !== null && <div className={row}><span className="text-muted">{t('panel.cost')}</span><span className="font-mono">{workspace.costInDollars.toFixed(2)} $</span></div>}
      </section>
    </aside>
  )
}
