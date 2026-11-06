import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDialog } from '@/hooks/use_dialog'
import { isOnboarded } from '@/modules/onboarding'
import { AddProjectDialog, saveProjectLayout, useActivateProject, useActiveProjectId, useProjects } from '@/modules/projects'
import { PublishDialog } from '@/modules/review'
import { NewRunDialog } from '@/modules/runs'
import { useAllWorkspaces } from '@/modules/workspaces'
import AboutDialog from '../components/about_dialog'
import CommandPalette from '../components/command_palette'
import ProjectSidebar from '../components/project_sidebar'
import StatusBar from '../components/status_bar'
import TitleBar from '../components/title_bar'

const SAVED_PATH = /^\/(workspaces|runs)\//

/** The window around every page: top bar, project sidebar, status bar and the dialogs. */
export default function ShellLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const palette = useDialog('palette')
  const newRun = useDialog('new-run')
  const { data: projects, isSuccess } = useProjects()
  const activeProjectId = useActiveProjectId()
  const activate = useActivateProject()
  const all = useAllWorkspaces()
  const showSidebar = !location.pathname.startsWith('/settings') && !location.pathname.startsWith('/welcome')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 'k') {
        event.preventDefault()
        palette.toggle()
      } else if (key === 'n') {
        event.preventDefault()
        newRun.show()
      } else if (key === ',') {
        event.preventDefault()
        navigate('/settings')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [palette, newRun, navigate])

  useEffect(() => {
    if (isSuccess && projects.length === 0 && location.pathname === '/' && !isOnboarded()) navigate('/welcome', { replace: true })
  }, [isSuccess, projects, location.pathname, navigate])

  // The project whose workspace is on screen is the active one, however the person got there.
  useEffect(() => {
    const match = /^\/(?:workspaces|runs)\/([^/]+)/.exec(location.pathname)
    if (match === null) return
    const owner = all.find(entry => entry.workspaces.some(workspace => workspace.identifier === match[1] || workspace.runIdentifier === match[1]))
    if (owner && owner.project.identifier !== activeProjectId && !activate.isPending) activate.mutate(owner.project.identifier)
  }, [location.pathname, all, activeProjectId, activate])

  // Leaving a project must bring the person back to the same place, so the place is kept.
  useEffect(() => {
    if (activeProjectId !== null && SAVED_PATH.test(location.pathname)) void saveProjectLayout(activeProjectId, { path: location.pathname })
  }, [activeProjectId, location.pathname])

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        {showSidebar && <ProjectSidebar />}
        <Outlet />
      </div>
      <StatusBar />
      <CommandPalette />
      <AddProjectDialog />
      <NewRunDialog />
      <PublishDialog />
      <AboutDialog />
    </div>
  )
}
