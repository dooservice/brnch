import { ConstructionIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import EmptyState from '@/components/empty_state'
import WorkspaceLayout from '@/modules/workspaces/components/workspace_layout'

/** The tabs that are not built yet say so, instead of showing an empty screen. */
export default function WorkspaceSoon() {
  const { t } = useTranslation('workspaces')
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { pathname } = useLocation()
  const tab = pathname.endsWith('/terminal') ? 'terminal' : 'files'
  return (
    <WorkspaceLayout workspaceIdentifier={workspaceId}>
      <EmptyState icon={ConstructionIcon} title={t(`soon.${tab}.title`)} description={t(`soon.${tab}.description`)} />
    </WorkspaceLayout>
  )
}
