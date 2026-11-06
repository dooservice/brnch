import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-3 py-10 text-center">
      <Icon size={36} strokeWidth={1.5} className="text-muted" />
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="text-muted">{description}</p>}
      {action}
    </div>
  )
}
