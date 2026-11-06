import { cn } from '@/lib/utils'

export default function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn('rounded border border-line px-1.5 font-mono text-[10.5px] text-muted', className)}>{children}</kbd>
}
