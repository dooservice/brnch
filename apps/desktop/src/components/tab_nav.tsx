import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface TabItem {
  to: string
  label: string
  icon: LucideIcon
  /** The root tab matches only its own path, not the ones below it. */
  end?: boolean
  /** A small count next to the label, such as the files changed. */
  badge?: number
}

/** Tabs that are links, so the address always says which one is open. */
export default function TabNav({ tabs }: { tabs: TabItem[] }) {
  return (
    <div role="tablist" className="flex h-9.5 items-end gap-0.5 border-b border-line px-3">
      {tabs.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          role="tab"
          className={({ isActive }) => cn('flex h-9 items-center gap-1.5 px-3 font-medium', isActive ? 'text-ink shadow-[inset_0_-2px_0_var(--color-ink)]' : 'text-muted hover:text-ink')}
        >
          <Icon size={14} />
          {label}
          {badge !== undefined && badge > 0 && <span className="inline-flex h-4.5 items-center rounded-full border border-line px-1.5 text-[11px] text-muted">{badge}</span>}
        </NavLink>
      ))}
    </div>
  )
}
