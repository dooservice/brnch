import { BanIcon, GitBranchIcon, UploadIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Badge from '@/components/badge'
import Button from '@/components/button'
import EmptyState from '@/components/empty_state'
import TabNav from '@/components/tab_nav'
import { useDialog } from '@/hooks/use_dialog'
import { useNow } from '@/hooks/use_now'
import { WORKSPACE_TABS } from '../constants'
import { useStopRun, useWorkspace } from '../api/use_workspaces'

/** What every page of a workspace shares: its title, state, actions and tabs. */
export default function WorkspaceLayout({ workspaceIdentifier, children }: { workspaceIdentifier: string | undefined; children: React.ReactNode }) {
  const { t } = useTranslation('workspaces')
  const { workspace } = useWorkspace(workspaceIdentifier)
  const stop = useStopRun()
  const publish = useDialog('publish')
  const now = useNow()

  if (workspace === null) {
    return <EmptyState icon={BanIcon} title={t('missing.title')} description={t('missing.description')} />
  }
  const minutes = workspace.startedAtMilliseconds === null ? 0 : Math.max(0, Math.round((now - workspace.startedAtMilliseconds) / 60_000))
  const base = `/workspaces/${workspace.identifier}`
  const tabs = WORKSPACE_TABS.map(tab => ({ to: `${base}${tab.segment}`, label: t(`tabs.${tab.key}`), icon: tab.icon, end: tab.segment === '' }))

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <h1 className="truncate text-[15px] font-semibold">{workspace.title}</h1>
        <Badge className="font-mono"><GitBranchIcon size={12} />{workspace.branchName}</Badge>
        {workspace.status === 'running' && <Badge variant="warning">{t('status.working', { count: minutes })}</Badge>}
        {workspace.status === 'done' && <Badge variant="info">{t('status.reviewReady')}</Badge>}
        {workspace.status === 'failed' && <Badge variant="danger">{t('status.failed')}</Badge>}
        <span className="flex-1" />
        {workspace.status === 'running' && <Button variant="outline" loading={stop.isPending} onClick={() => stop.mutate(workspace.identifier)}>{t('actions.stop')}</Button>}
        <Button icon={<UploadIcon size={13} />} disabled={workspace.status === 'running' || workspace.runIdentifier === null} onClick={() => publish.show({ workspaces: workspace.identifier })}>{t('actions.publish')}</Button>
      </header>
      <TabNav tabs={tabs} />
      <section className="flex min-h-0 flex-1 flex-col">{children}</section>
    </main>
  )
}
