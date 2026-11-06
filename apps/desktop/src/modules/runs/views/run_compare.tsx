import { BanIcon, BotIcon, CircleCheckIcon, FileDiffIcon, TriangleAlertIcon, UploadIcon } from 'lucide-react'
import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import Badge from '@/components/badge'
import Button from '@/components/button'
import EmptyState from '@/components/empty_state'
import { useDialog } from '@/hooks/use_dialog'
import { failureText } from '@/lib/tauri'
import { parseUnifiedDiff } from '@/lib/unified_diff'
import { cn } from '@/lib/utils'
import { StatusIcon, diffQuery, groupRuns, useAllWorkspaces, useProjectConflicts } from '@/modules/workspaces'
import { recommendWorkspace } from '@/modules/runs/lib/recommend_run'

/** The results of one run side by side: what each agent did, who clashes with whom, and a pick. */
export default function RunCompare() {
  const { t } = useTranslation('runs')
  const { runId } = useParams<{ runId: string }>()
  const navigate = useNavigate()
  const publish = useDialog('publish')
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set())
  const all = useAllWorkspaces()
  const entry = all.find(candidate => candidate.workspaces.some(workspace => workspace.runIdentifier === runId))
  const group = entry ? groupRuns(entry.workspaces).groups.find(candidate => candidate.runIdentifier === runId) ?? null : null
  const workspaces = group?.workspaces ?? []
  const diffs = useQueries({ queries: workspaces.map(workspace => diffQuery(workspace.identifier, workspace.status)) })
  const fingerprint = workspaces.map(workspace => `${workspace.identifier}:${workspace.status}`).join(',')
  const conflicts = useProjectConflicts(entry?.project.identifier ?? null, fingerprint)

  if (group === null) return <EmptyState icon={BanIcon} title={t('compare.missing')} />

  const inGroup = new Set(workspaces.map(workspace => workspace.identifier))
  const relevant = (conflicts.data ?? []).filter(conflict => inGroup.has(conflict.firstWorkspaceIdentifier) && inGroup.has(conflict.secondWorkspaceIdentifier))
  const clashing = new Set(relevant.flatMap(conflict => [conflict.firstWorkspaceIdentifier, conflict.secondWorkspaceIdentifier]))
  const recommended = recommendWorkspace(workspaces, clashing)
  const clashBetween = (first: string, second: string) => relevant.some(conflict => (conflict.firstWorkspaceIdentifier === first && conflict.secondWorkspaceIdentifier === second) || (conflict.firstWorkspaceIdentifier === second && conflict.secondWorkspaceIdentifier === first))
  const nameOf = (identifier: string) => workspaces.find(workspace => workspace.identifier === identifier)?.branchName ?? identifier
  const toggle = (identifier: string) => {
    const next = new Set(chosen)
    if (!next.delete(identifier)) next.add(identifier)
    setChosen(next)
  }
  const publishNow = (identifiers: string[]) => publish.show({ workspaces: identifiers.join(',') })
  const short = (branch: string) => branch.split('/').pop() ?? branch
  const row = 'flex items-center justify-between border-b border-[#1c1c21] px-4 py-2'

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="flex items-center gap-3 pb-5">
        <h1 className="text-[15px] font-semibold">{t('compare.title', { title: group.title })}</h1>
        <Badge>{t('compare.agents', { count: workspaces.length })}</Badge>
        <span className="flex-1" />
        <Button icon={<UploadIcon size={13} />} disabled={chosen.size === 0} onClick={() => publishNow([...chosen])}>{t('compare.publishSelected', { count: chosen.size })}</Button>
      </div>
      {conflicts.isError && <p role="alert" className="mb-3 text-danger">{failureText(conflicts.error)}</p>}
      <ul className="flex gap-4" aria-label={t('compare.results')}>
        {workspaces.map((workspace, index) => {
          const files = diffs[index]?.data ? parseUnifiedDiff(diffs[index].data.unifiedDiff) : null
          const own = relevant.filter(conflict => conflict.firstWorkspaceIdentifier === workspace.identifier || conflict.secondWorkspaceIdentifier === workspace.identifier)
          return (
            <li key={workspace.identifier} className={cn('flex min-w-0 flex-1 flex-col rounded-xl border bg-card', recommended?.identifier === workspace.identifier ? 'border-[#3c3c46]' : 'border-line')}>
              <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
                <BotIcon size={16} className="text-muted" />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{workspace.agentLabel}</p><p className="truncate font-mono text-[11.5px] text-muted">{workspace.branchName}</p></div>
                {recommended?.identifier === workspace.identifier && <Badge variant="success">{t('compare.recommended')}</Badge>}
                <StatusIcon status={workspace.status} />
              </div>
              <div className={row}><span className="text-muted">{t('compare.files')}</span><span>{files ? files.length : '…'}</span></div>
              <div className={row}><span className="text-muted">{t('compare.lines')}</span><span className="font-mono">{files ? <><span className="text-ok">+{files.reduce((sum, file) => sum + file.added, 0)}</span> <span className="text-danger">−{files.reduce((sum, file) => sum + file.removed, 0)}</span></> : '…'}</span></div>
              <div className={row}><span className="text-muted">{t('compare.costTime')}</span><span className="font-mono">{workspace.costInDollars !== null ? `${workspace.costInDollars.toFixed(2)} $` : '—'}{workspace.durationInMilliseconds !== null ? ` · ${(workspace.durationInMilliseconds / 1000).toFixed(0)} s` : ''}</span></div>
              <div className={row}><span className="text-muted">{t('compare.conflicts')}</span>{conflicts.isPending ? '…' : own.length === 0 ? <span className="flex items-center gap-1.5 text-ok"><CircleCheckIcon size={13} />{t('compare.none')}</span> : <span className="flex items-center gap-1.5 text-danger"><TriangleAlertIcon size={13} />{t('compare.withCount', { count: own.length })}</span>}</div>
              <div className="mt-auto flex gap-2 border-t border-line p-3.5">
                <Button variant="outline" className="flex-1" icon={<FileDiffIcon size={13} />} onClick={() => navigate(`/workspaces/${workspace.identifier}/changes`)}>{t('compare.viewChanges')}</Button>
                <label className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-line"><input type="checkbox" checked={chosen.has(workspace.identifier)} onChange={() => toggle(workspace.identifier)} aria-label={t('compare.select', { name: workspace.branchName })} className="size-3.5 accent-white" /></label>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-4 flex gap-4">
        <section className="w-105 shrink-0 rounded-xl border border-line bg-card p-4">
          <h2 className="mb-3 font-semibold">{t('compare.matrix')} <span className="font-normal text-muted">· {t('compare.byGitd')}</span></h2>
          <table className="w-full border-separate border-spacing-1.5 text-center">
            <thead><tr><th />{workspaces.map(workspace => <th key={workspace.identifier} className="truncate text-[11px] font-normal text-muted">{short(workspace.branchName)}</th>)}</tr></thead>
            <tbody>
              {workspaces.map(rowWorkspace => (
                <tr key={rowWorkspace.identifier}>
                  <th className="truncate text-left text-[11px] font-normal text-muted">{short(rowWorkspace.branchName)}</th>
                  {workspaces.map(column => {
                    const same = rowWorkspace.identifier === column.identifier
                    const clash = !same && clashBetween(rowWorkspace.identifier, column.identifier)
                    return (
                      <td key={column.identifier} className={cn('h-8 rounded-md', same ? 'bg-hover text-muted' : clash ? 'bg-[#2a1416] text-danger' : 'bg-[#0e2219] text-ok')} aria-label={same ? undefined : `${nameOf(rowWorkspace.identifier)} / ${nameOf(column.identifier)}: ${clash ? t('compare.clash') : t('compare.clean')}`}>
                        {same ? '—' : clash ? <TriangleAlertIcon size={13} className="mx-auto" /> : <CircleCheckIcon size={13} className="mx-auto" />}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {relevant.map(conflict => (
            <p key={`${conflict.firstWorkspaceIdentifier}${conflict.secondWorkspaceIdentifier}`} className="mt-2 text-[12px] text-muted">{t('compare.clashOn', { first: nameOf(conflict.firstWorkspaceIdentifier), second: nameOf(conflict.secondWorkspaceIdentifier), paths: conflict.clashingPaths.join(', ') })}</p>
          ))}
        </section>
        <section className="min-w-0 flex-1 rounded-xl border border-line bg-card p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><CircleCheckIcon size={14} className="text-ok" />{t('compare.recommendation')}</h2>
          {recommended ? (
            <>
              <p className="leading-relaxed text-[#c4c4cc]">{t('compare.recommendBody', { name: recommended.branchName })}</p>
              <Button className="mt-3" icon={<UploadIcon size={13} />} onClick={() => publishNow([recommended.identifier])}>{t('compare.publishOne', { name: recommended.branchName })}</Button>
            </>
          ) : (
            <p className="text-muted">{t('compare.noRecommendation')}</p>
          )}
        </section>
      </div>
    </main>
  )
}
