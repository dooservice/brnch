import { useTranslation } from 'react-i18next'
import { systemName } from '@/lib/system'
import { useActiveProjectId, useProjects } from '@/modules/projects'
import { useGitdStatus } from '@/modules/settings'
import { useAllWorkspaces } from '@/modules/workspaces'

/** The bottom line: is gitd answering, and what is going on in the open project. */
export default function StatusBar() {
  const { t } = useTranslation('shell')
  const gitd = useGitdStatus()
  const { data: projects = [] } = useProjects()
  const activeProjectId = useActiveProjectId()
  const all = useAllWorkspaces()
  const project = projects.find(candidate => candidate.identifier === activeProjectId)
  const running = all.flatMap(entry => entry.workspaces).filter(workspace => workspace.status === 'running').length

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-line bg-side px-3 text-[11.5px] text-muted">
      <span className="flex items-center gap-1.5">
        <span className={`size-1.75 rounded-full ${gitd.isPending ? 'bg-muted' : gitd.data?.connected ? 'bg-ok' : 'bg-warn'}`} />
        {gitd.isPending ? t('status.gitdChecking') : gitd.data?.connected ? t('status.gitdConnected') : t('status.gitdDown')}
      </span>
      {project && <span className="font-mono">{project.name}</span>}
      <span>{t('status.running', { count: running })}</span>
      <span className="flex-1" />
      <span>{systemName()}</span>
    </footer>
  )
}
