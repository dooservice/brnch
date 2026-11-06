import type { ProjectWorkspaces } from '@/modules/workspaces'
import type { Workspace } from '@/modules/workspaces'

export interface LocationDescription {
  workspace: Workspace | null
  tab: 'agent' | 'changes' | 'files' | 'terminal' | null
}

/** What a saved path points at, so the palette can say where entering a project leads. */
export function describeLocation(path: string, all: readonly ProjectWorkspaces[]): LocationDescription {
  const match = /^\/workspaces\/([^/]+)(?:\/(changes|files|terminal))?$/.exec(path)
  if (match === null) return { workspace: null, tab: null }
  const workspace = all.flatMap(entry => entry.workspaces).find(candidate => candidate.identifier === match[1]) ?? null
  return { workspace, tab: (match[2] as LocationDescription['tab']) ?? 'agent' }
}
