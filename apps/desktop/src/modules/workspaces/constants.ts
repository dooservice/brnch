import { FileTextIcon, GitCompareArrowsIcon, MessageSquareIcon, SquareTerminalIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type WorkspaceTabKey = 'agent' | 'changes' | 'files' | 'terminal'

/** The tabs of a workspace, in order; each owns the path segment that opens it. */
export const WORKSPACE_TABS: { key: WorkspaceTabKey; segment: string; icon: LucideIcon }[] = [
  { key: 'agent', segment: '', icon: MessageSquareIcon },
  { key: 'changes', segment: '/changes', icon: GitCompareArrowsIcon },
  { key: 'files', segment: '/files', icon: FileTextIcon },
  { key: 'terminal', segment: '/terminal', icon: SquareTerminalIcon },
]
