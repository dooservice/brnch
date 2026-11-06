import { CircleIcon, CircleXIcon, Loader2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { WorkspaceStatus } from '../types/workspace.types'

/** One icon per state of a workspace's agent, the same everywhere it is shown. */
export default function StatusIcon({ status, size = 14 }: { status: WorkspaceStatus; size?: number }) {
  const { t } = useTranslation('workspaces')
  const label = t(`status.${status}`)
  switch (status) {
    case 'running':
      return <Loader2Icon size={size} role="img" aria-label={label} className="shrink-0 animate-spin text-warn" />
    case 'failed':
      return <CircleXIcon size={size} role="img" aria-label={label} className="shrink-0 text-danger" />
    case 'done':
      return <CircleIcon size={size} role="img" aria-label={label} className="shrink-0 text-info" />
    case 'idle':
      return <CircleIcon size={size} role="img" aria-label={label} className="shrink-0 text-muted" />
  }
}
