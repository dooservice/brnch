import * as Menu from '@radix-ui/react-dropdown-menu'
import Kbd from '@/components/kbd'

export interface MenuEntry {
  label: string
  shortcut?: string
  onSelect: () => void
}

/** A menu in the title bar: its name and what it offers. */
export default function DropdownMenu({ label, entries }: { label: string; entries: MenuEntry[] }) {
  return (
    <Menu.Root>
      <Menu.Trigger className="rounded px-2 py-1 text-muted outline-none hover:text-ink data-[state=open]:bg-hover data-[state=open]:text-ink">{label}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={4} className="z-50 min-w-52 rounded-lg border border-[#33333b] bg-card p-1 shadow-2xl">
          {entries.map(entry => (
            <Menu.Item key={entry.label} onSelect={entry.onSelect} className="flex cursor-pointer items-center justify-between gap-8 rounded px-2.5 py-1.5 outline-none data-[highlighted]:bg-hover">
              <span>{entry.label}</span>
              {entry.shortcut && <Kbd className="border-transparent">{entry.shortcut}</Kbd>}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
