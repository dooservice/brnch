import { useParams } from 'react-router-dom'
import ReviewView from '@/modules/review/components/review_view'
import { WorkspaceLayout, useWorkspace } from '@/modules/workspaces'

export default function WorkspaceChanges() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { workspace } = useWorkspace(workspaceId)
  return (
    <WorkspaceLayout workspaceIdentifier={workspaceId}>
      {workspace !== null && <ReviewView key={workspace.identifier} workspace={workspace} />}
    </WorkspaceLayout>
  )
}
