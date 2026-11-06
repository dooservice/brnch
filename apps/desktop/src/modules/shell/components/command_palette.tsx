import * as RadixDialog from '@radix-ui/react-dialog'
import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { FolderGit2Icon, GitBranchIcon, MergeIcon, PlusIcon, SearchIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import Kbd from '@/components/kbd'
import { useDialog } from '@/hooks/use_dialog'
import { loadProjectLayout, useEnterProject } from '@/modules/projects'
import { useAllWorkspaces } from '@/modules/workspaces'
import { describeLocation } from '../lib/describe_location'

const GROUP_HEADING = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase'

/** Ctrl K: jump to any project or workspace, see where a project would take you, or run an action. */
export default function CommandPalette() {
  const { t } = useTranslation('shell')
  const dialog = useDialog('palette')
  const addProject = useDialog('add-project')
  const newRun = useDialog('new-run')
  const navigate = useNavigate()
  const enterProject = useEnterProject()
  const all = useAllWorkspaces()
  const [highlighted, setHighlighted] = useState('')

  const run = (action: () => void) => {
    dialog.hide()
    action()
  }
  const highlightedProject = highlighted.startsWith('project:') ? highlighted.slice('project:'.length) : null
  const highlightedWorkspace = highlighted.startsWith('workspace:') ? all.flatMap(entry => entry.workspaces).find(workspace => workspace.identifier === highlighted.split(':')[1]) : undefined
  const layout = useQuery({
    queryKey: ['layout', highlightedProject] as const,
    queryFn: () => loadProjectLayout(highlightedProject ?? ''),
    enabled: highlightedProject !== null && dialog.open,
  })
  const location = describeLocation(layout.data?.path ?? '', all)

  return (
    <RadixDialog.Root open={dialog.open} onOpenChange={open => (open ? dialog.show() : dialog.hide())}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="overlay" />
        <RadixDialog.Content aria-label={t('palette.label')} className="modal top-22 w-245 overflow-hidden">
          <RadixDialog.Title className="sr-only">{t('palette.label')}</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">{t('palette.hint')}</RadixDialog.Description>
          <Command value={highlighted} onValueChange={setHighlighted}>
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <SearchIcon size={16} className="text-muted" />
              <Command.Input placeholder={t('palette.placeholder')} className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
              <Kbd>Esc</Kbd>
            </div>
            <div className="flex">
              <Command.List className="h-128 w-140 shrink-0 overflow-y-auto border-r border-line p-1.5">
                <Command.Empty className="px-3 py-6 text-center text-muted">{t('palette.empty')}</Command.Empty>
                <Command.Group heading={t('palette.workspaces')} className={GROUP_HEADING}>
                  {all.flatMap(({ project, workspaces }) =>
                    workspaces.map(workspace => (
                      <Item key={workspace.identifier} value={`workspace:${workspace.identifier}:${workspace.title} ${project.name}`} onSelect={() => run(() => navigate(`/workspaces/${workspace.identifier}`))}>
                        <GitBranchIcon size={14} className="text-muted" />
                        <span className="flex-1 truncate">{workspace.title}</span>
                        <span className="text-[12px] text-muted">{project.name}</span>
                      </Item>
                    )),
                  )}
                </Command.Group>
                <Command.Group heading={t('palette.projects')} className={GROUP_HEADING}>
                  {all.map(({ project, workspaces }) => (
                    <Item key={project.identifier} value={`project:${project.identifier}:${project.name}`} onSelect={() => run(() => void enterProject(project.identifier))}>
                      <FolderGit2Icon size={14} className="text-muted" />
                      <span className="flex-1">{project.name}</span>
                      <span className="text-[12px] text-muted">{t('palette.workspaceCount', { count: workspaces.length })}</span>
                    </Item>
                  ))}
                </Command.Group>
                <Command.Group heading={t('palette.actions')} className={GROUP_HEADING}>
                  <Item value="action:new-run" onSelect={() => run(() => newRun.show())}><MergeIcon size={14} className="text-muted" /><span className="flex-1">{t('palette.newRun')}</span><Kbd>Ctrl N</Kbd></Item>
                  <Item value="action:add-project" onSelect={() => run(() => addProject.show())}><PlusIcon size={14} className="text-muted" /><span className="flex-1">{t('palette.addProject')}</span></Item>
                  <Item value="action:settings" onSelect={() => run(() => navigate('/settings'))}><SlidersHorizontalIcon size={14} className="text-muted" /><span className="flex-1">{t('palette.settings')}</span><Kbd>Ctrl ,</Kbd></Item>
                </Command.Group>
              </Command.List>
              <div className="flex flex-1 flex-col gap-1.5 p-5" aria-live="polite">
                {highlightedProject !== null && (
                  <>
                    <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{t('palette.restores')}</p>
                    {location.workspace ? (
                      <>
                        <p className="mt-1 text-base font-semibold">{location.workspace.title}</p>
                        <p className="font-mono text-[12px] text-muted">{location.workspace.branchName}</p>
                        <p className="mt-2 text-muted">{t('palette.tab', { tab: t(`palette.tabs.${location.tab ?? 'agent'}`) })}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-muted">{t('palette.nothingSaved')}</p>
                    )}
                    <p className="mt-3 border-t border-line pt-3 text-[12px] leading-relaxed text-muted">{t('palette.contextNote')}</p>
                  </>
                )}
                {highlightedWorkspace && (
                  <>
                    <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">{t('palette.workspace')}</p>
                    <p className="mt-1 text-base font-semibold">{highlightedWorkspace.title}</p>
                    <p className="font-mono text-[12px] text-muted">{highlightedWorkspace.branchName}</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex h-9.5 items-center gap-4 border-t border-line px-4 text-[12px] text-muted">
              <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd>{t('palette.navigate')}</span>
              <span className="flex items-center gap-1.5"><Kbd>↵</Kbd>{t('palette.open')}</span>
            </div>
          </Command>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

function Item(props: { value: string; onSelect: () => void; children: React.ReactNode }) {
  return (
    <Command.Item value={props.value} onSelect={props.onSelect} className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 data-[selected=true]:bg-hover">
      {props.children}
    </Command.Item>
  )
}
