import { BanIcon, ChevronDownIcon, GitBranchIcon, Loader2Icon, SquareIcon, TriangleAlertIcon, UploadIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Badge from '@/components/badge'
import Button from '@/components/button'
import EmptyState from '@/components/empty_state'
import TabNav from '@/components/tab_nav'
import { useDialog } from '@/hooks/use_dialog'
import { useNow } from '@/hooks/use_now'
import { WORKSPACE_TABS } from '../constants'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { useNavigate } from 'react-router-dom'
import { useWorkspaceStatistics } from '../api/use_workspace_statistics'
import { useProjectConflicts } from '../api/use_workspace_review_data'
import { useAllWorkspaces, useStopRun, useWorkspace } from '../api/use_workspaces'

/** What every page of a workspace shares: its title, state, actions and tabs. */
export default function WorkspaceLayout({ workspaceIdentifier, children }: { workspaceIdentifier: string | undefined; children: React.ReactNode }) {
  const { t } = useTranslation('workspaces')
  const { workspace, project } = useWorkspace(workspaceIdentifier)
  const siblings = useAllWorkspaces().find(entry => entry.project.identifier === project?.identifier)?.workspaces ?? []
  const fingerprint = siblings.map(sibling => `${sibling.identifier}:${sibling.status}`).join(',')
  const conflicts = useProjectConflicts(project?.identifier ?? null, fingerprint, siblings.length >= 2)
  const stop = useStopRun()
  const publish = useDialog('publish')
  const now = useNow()
  const navigate = useNavigate()
  const statistics = useWorkspaceStatistics(useAllWorkspaces())

  if (workspace === null) {
    return <EmptyState icon={BanIcon} title={t('missing.title')} description={t('missing.description')} />
  }
  const clash = conflicts.data?.find(conflict => conflict.firstWorkspaceIdentifier === workspace.identifier || conflict.secondWorkspaceIdentifier === workspace.identifier)
  const otherIdentifier = clash ? (clash.firstWorkspaceIdentifier === workspace.identifier ? clash.secondWorkspaceIdentifier : clash.firstWorkspaceIdentifier) : null
  const clashingWith = otherIdentifier === null ? null : (siblings.find(sibling => sibling.identifier === otherIdentifier)?.branchName.split('/').pop() ?? otherIdentifier)
  const minutes = workspace.startedAtMilliseconds === null ? 0 : Math.max(0, Math.round((now - workspace.startedAtMilliseconds) / 60_000))
  const base = `/workspaces/${workspace.identifier}`
  const changed = statistics.get(workspace.identifier)?.files
  const tabs = WORKSPACE_TABS.map(tab => ({ to: `${base}${tab.segment}`, label: t(`tabs.${tab.key}`), icon: tab.icon, end: tab.segment === '', badge: tab.key === 'changes' ? changed : undefined }))

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <h1 className="truncate text-[15px] font-semibold">{workspace.title}</h1>
        <Badge className="font-mono"><GitBranchIcon size={12} />{workspace.branchName}</Badge>
        {workspace.status === 'running' && <Badge variant="warning"><Loader2Icon size={12} className="animate-spin" />{t('status.working', { count: minutes })}</Badge>}
        {workspace.status === 'done' && <Badge variant="info">{t('status.reviewReady')}</Badge>}
        {workspace.status === 'failed' && <Badge variant="danger">{t('status.failed')}</Badge>}
        {clashingWith !== null && <Badge variant="danger"><TriangleAlertIcon size={12} />{t('status.clashesWith', { name: clashingWith })}</Badge>}
        <span className="flex-1" />
        {workspace.status === 'running' && <Button variant="outline" icon={<SquareIcon size={12} />} loading={stop.isPending} onClick={() => stop.mutate(workspace.identifier)}>{t('actions.stop')}</Button>}
        <div className="flex">
          <Button className="rounded-r-none" icon={<UploadIcon size={13} />} disabled={workspace.status === 'running' || workspace.runIdentifier === null} onClick={() => publish.show({ workspaces: workspace.identifier })}>{t('actions.publish')}</Button>
          <Menu.Root>
            <Menu.Trigger aria-label={t('actions.moreOptions')} className="btn-primary rounded-l-none border-l border-canvas/30 px-1.5"><ChevronDownIcon size={13} /></Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={4} className="z-50 min-w-52 rounded-lg border border-[#33333b] bg-card p-1 shadow-2xl">
                <Menu.Item disabled={workspace.status === 'running' || workspace.runIdentifier === null} onSelect={() => publish.show({ workspaces: workspace.identifier })} className="cursor-pointer rounded px-2.5 py-1.5 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-hover">{t('actions.publishBranch')}</Menu.Item>
                {workspace.runIdentifier !== null && <Menu.Item onSelect={() => navigate(`/runs/${workspace.runIdentifier}`)} className="cursor-pointer rounded px-2.5 py-1.5 outline-none data-[highlighted]:bg-hover">{t('actions.compareRun')}</Menu.Item>}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </header>
      <TabNav tabs={tabs} />
      <section className="flex min-h-0 flex-1 flex-col">{children}</section>
    </main>
  )
}
