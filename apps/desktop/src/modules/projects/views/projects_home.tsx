import { FolderPlusIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/button'
import EmptyState from '@/components/empty_state'
import { useDialog } from '@/hooks/use_dialog'
import { loadProjectLayout, useActiveProjectId, useProjects } from '@/modules/projects/api/use_projects'

/** The start page: back to where the active project was left, or the invitation to add one. */
export default function ProjectsHome() {
  const { t } = useTranslation('projects')
  const { data: projects = [], isPending } = useProjects()
  const activeProjectId = useActiveProjectId()
  const addProject = useDialog('add-project')
  const navigate = useNavigate()
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    if (activeProjectId === null || restored) return
    let cancelled = false
    loadProjectLayout(activeProjectId).then(layout => {
      if (cancelled) return
      setRestored(true)
      if (layout !== null && layout.path !== '/') navigate(layout.path, { replace: true })
    })
    return () => {
      cancelled = true
    }
  }, [activeProjectId, restored, navigate])

  if (isPending) return null
  return (
    <main className="flex flex-1">
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderPlusIcon}
          title={t('home.noProjectsTitle')}
          description={t('home.noProjectsDescription')}
          action={<Button onClick={() => addProject.show()}>{t('home.addFirst')}</Button>}
        />
      ) : (
        <EmptyState icon={FolderPlusIcon} title={t('home.chooseTitle')} description={t('home.chooseDescription')} />
      )}
    </main>
  )
}
