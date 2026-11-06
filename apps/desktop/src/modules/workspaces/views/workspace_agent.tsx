import { useParams } from 'react-router-dom'
import AgentTimeline from '@/modules/workspaces/components/agent_timeline'
import Composer from '@/modules/workspaces/components/composer'
import SidePanel from '@/modules/workspaces/components/side_panel'
import WorkspaceLayout from '@/modules/workspaces/components/workspace_layout'
import { useAllWorkspaces, useWorkspace } from '@/modules/workspaces/api/use_workspaces'
import { useWorkspaceEvents } from '@/modules/workspaces/api/use_workspace_events'

/** The Agente tab: the conversation, a box to continue it and what has changed so far. */
export default function WorkspaceAgent() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const { workspace, project } = useWorkspace(workspaceId)
  const { data: entries = [] } = useWorkspaceEvents(workspaceId)
  const siblings = useAllWorkspaces().find(entry => entry.project.identifier === project?.identifier)?.workspaces ?? []

  return (
    <WorkspaceLayout workspaceIdentifier={workspaceId}>
      {workspace !== null && project !== null && (
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto p-6"><AgentTimeline entries={entries} /></div>
            <Composer workspace={workspace} />
          </div>
          <SidePanel workspace={workspace} projectIdentifier={project.identifier} siblings={siblings} />
        </div>
      )}
    </WorkspaceLayout>
  )
}
