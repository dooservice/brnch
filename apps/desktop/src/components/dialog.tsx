import * as RadixDialog from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  /** A panel pinned to the right edge instead of a window in the middle. */
  side?: boolean
  className?: string
}

/** A dialog with its header, body and footer; every modal in the app is one of these. */
export default function Dialog({ open, onOpenChange, title, description, children, footer, side = false, className }: DialogProps) {
  const { t } = useTranslation()
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="overlay" />
        <RadixDialog.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(side ? 'fixed inset-y-0 right-0 flex w-130 flex-col border-l border-[#33333b] bg-card shadow-2xl' : 'modal', className)}
        >
          <div className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3.5">
            <div className="flex-1">
              <RadixDialog.Title className="text-base font-semibold">{title}</RadixDialog.Title>
              <RadixDialog.Description className="mt-0.5 text-[12px] text-muted">{description}</RadixDialog.Description>
            </div>
            <RadixDialog.Close aria-label={t('close')} className="text-muted hover:text-ink"><XIcon size={16} /></RadixDialog.Close>
          </div>
          <div className={cn(side && 'flex-1 overflow-y-auto')}>{children}</div>
          {footer && <div className="flex items-center gap-2.5 border-t border-line px-5 py-3.5">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
