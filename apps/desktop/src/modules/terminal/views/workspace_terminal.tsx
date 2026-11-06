import { useParams } from 'react-router-dom'
import TerminalView from '@/modules/terminal/components/terminal_view'
import { WorkspaceLayout, useWorkspace } from '@/modules/workspaces'

export default function WorkspaceTerminal() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { workspace } = useWorkspace(workspaceId)
  return (
    <WorkspaceLayout workspaceIdentifier={workspaceId}>
      {workspace !== null && <TerminalView key={workspace.identifier} workspaceIdentifier={workspace.identifier} />}
    </WorkspaceLayout>
  )
}
