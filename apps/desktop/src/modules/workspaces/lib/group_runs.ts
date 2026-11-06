import type { RunGroup, Workspace } from '../types/workspace.types'

/** Runs with more than one workspace become a group; the rest stay as single workspaces. */
export function groupRuns(workspaces: readonly Workspace[]): { groups: RunGroup[]; singles: Workspace[] } {
  const byRun = new Map<string, Workspace[]>()
  const singles: Workspace[] = []
  for (const workspace of workspaces) {
    if (workspace.runIdentifier === null) singles.push(workspace)
    else byRun.set(workspace.runIdentifier, [...(byRun.get(workspace.runIdentifier) ?? []), workspace])
  }
  const groups: RunGroup[] = []
  for (const [runIdentifier, members] of byRun) {
    if (members.length > 1) groups.push({ runIdentifier, title: members[0]!.title, workspaces: members })
    else singles.push(...members)
  }
  return { groups, singles }
}
