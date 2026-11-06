import type { Workspace } from '@/modules/workspaces'

/**
 * Which workspace of a run to publish: among those that finished without failing and clash with
 * nobody, the cheapest. Returns null when none qualifies.
 */
export function recommendWorkspace(workspaces: readonly Workspace[], clashing: ReadonlySet<string>): Workspace | null {
  const candidates = workspaces.filter(workspace => workspace.status === 'done' && !clashing.has(workspace.identifier))
  if (candidates.length === 0) return null
  return [...candidates].sort((first, second) => (first.costInDollars ?? Infinity) - (second.costInDollars ?? Infinity))[0] ?? null
}
