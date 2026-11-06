import { ChevronDownIcon, ChevronRightIcon, FolderGit2Icon, GitMergeIcon, PlusIcon, SearchIcon, ShieldAlertIcon, ShieldCheckIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate } from 'react-router-dom'
import { useDialog } from '@/hooks/use_dialog'
import { cn } from '@/lib/utils'
import { useActiveProjectId, useEnterProject } from '@/modules/projects'
import { useSandboxStatus } from '@/modules/settings'
import { StatusIcon, groupRuns, useAllWorkspaces } from '@/modules/workspaces'
import type { Workspace } from '@/modules/workspaces'

/** Every project with its workspaces. One click anywhere changes the whole context. */
export default function ProjectSidebar() {
  const { t } = useTranslation('shell')
  const navigate = useNavigate()
  const all = useAllWorkspaces()
  const activeProjectId = useActiveProjectId()
  const enterProject = useEnterProject()
  const palette = useDialog('palette')
  const addProject = useDialog('add-project')
  const newRun = useDialog('new-run')
  const { data: sandbox } = useSandboxStatus()
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())

  /** Entering a project always shows its workspaces; clicking the open one folds it. */
  const choose = (identifier: string) => {
    const next = new Set(collapsed)
    if (identifier !== activeProjectId) {
      next.delete(identifier)
      void enterProject(identifier)
    } else if (!next.delete(identifier)) {
      next.add(identifier)
    }
    setCollapsed(next)
  }

  const rowClass = (active: boolean, indent: string) =>
    cn('mx-1.5 my-px flex w-[calc(100%-12px)] items-center gap-2.5 rounded-md py-1.5 pr-2.5 text-left hover:bg-hover', indent, active ? 'bg-hover text-ink' : 'text-[#c4c4cc]')
  const workspaceRow = (workspace: Workspace, indent: string, label: string = workspace.title) => (
    <NavLink key={workspace.identifier} to={`/workspaces/${workspace.identifier}`} className={({ isActive }) => rowClass(isActive, indent)}>
      <StatusIcon status={workspace.status} />
      <span className="flex-1 truncate">{label}</span>
      <span className="text-[11px] text-muted">{workspace.agentLabel}</span>
    </NavLink>
  )

  return (
    <nav aria-label={t('sidebar.projects')} className="flex w-70 shrink-0 flex-col border-r border-line bg-side">
      <div className="flex items-center justify-between py-3 pr-3 pl-3.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
        <span>{t('sidebar.projects')}</span>
        <span className="flex gap-0.5">
          <IconButton label={t('sidebar.search')} onClick={() => palette.show()}><SearchIcon size={14} /></IconButton>
          <IconButton label={t('sidebar.addProject')} onClick={() => addProject.show()}><PlusIcon size={14} /></IconButton>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto pb-3">
        {all.length === 0 && <p className="px-4 py-3 text-muted">{t('sidebar.empty')}</p>}
        {all.map(({ project, workspaces }) => {
          const isCollapsed = collapsed.has(project.identifier)
          const isActive = project.identifier === activeProjectId
          const { groups, singles } = groupRuns(workspaces)
          const working = workspaces.filter(workspace => workspace.status === 'running').length
          return (
            <div key={project.identifier}>
              <button type="button" aria-expanded={!isCollapsed} onClick={() => choose(project.identifier)} className="mx-1.5 flex w-[calc(100%-12px)] items-center gap-2 rounded-md px-3 py-1.5 text-left font-medium hover:bg-hover">
                {isCollapsed ? <ChevronRightIcon size={14} className="text-muted" /> : <ChevronDownIcon size={14} className="text-muted" />}
                <FolderGit2Icon size={14} className={isActive ? 'text-ink' : 'text-muted'} />
                <span className="flex-1 truncate">{project.name}</span>
                {isCollapsed && working > 0 && <span className="text-[11px] text-warn" aria-label={t('sidebar.working', { count: working })}>● {working}</span>}
                <span className="text-[11px] text-muted">{workspaces.length}</span>
              </button>
              {!isCollapsed && (
                <>
                  {groups.map(group => (
                    <div key={group.runIdentifier}>
                      <NavLink to={`/runs/${group.runIdentifier}`} className={({ isActive: current }) => rowClass(current, 'pl-8')}>
                        <GitMergeIcon size={14} className="text-muted" />
                        <span className="flex-1 truncate">{t('sidebar.runGroup', { title: group.title })}</span>
                        <span className="text-[11px] text-muted">{t('sidebar.agentCount', { count: group.workspaces.length })}</span>
                      </NavLink>
                      {group.workspaces.map(workspace => workspaceRow(workspace, 'pl-12', workspace.branchName.split('/').pop()))}
                    </div>
                  ))}
                  {singles.map(workspace => workspaceRow(workspace, 'pl-8'))}
                  {isActive && (
                    <button type="button" onClick={() => newRun.show()} className="mx-1.5 my-px flex w-[calc(100%-12px)] items-center gap-2.5 rounded-md py-1.5 pr-2.5 pl-8 text-left text-muted hover:bg-hover hover:text-ink">
                      <PlusIcon size={14} />{t('sidebar.newRun')}
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-2.5 border-t border-line px-3 py-2.5 text-[12px] text-muted">
        {sandbox?.available ? <ShieldCheckIcon size={14} className="text-ok" /> : <ShieldAlertIcon size={14} className="text-warn" />}
        <span className="flex-1 truncate" title={sandbox?.reason ?? undefined}>{sandbox === undefined ? t('sidebar.sandboxUnknown') : sandbox.available ? t('sidebar.sandboxActive') : t('sidebar.sandboxInactive')}</span>
        <IconButton label={t('sidebar.settings')} onClick={() => navigate('/settings')}><SlidersHorizontalIcon size={14} /></IconButton>
      </div>
    </nav>
  )
}

function IconButton(props: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={props.label} title={props.label} onClick={props.onClick} className="flex size-6 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink">
      {props.children}
    </button>
  )
}
