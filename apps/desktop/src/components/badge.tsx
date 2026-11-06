import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium', {
  variants: {
    variant: {
      muted: 'border-line text-muted',
      success: 'border-[#1d4a33] text-ok',
      warning: 'border-[#4a3a14] text-warn',
      danger: 'border-[#5a2326] text-danger',
      info: 'border-[#25365f] text-info',
    },
  },
  defaultVariants: { variant: 'muted' },
})

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export default function Badge({ variant, className, ...props }: BadgeProps) {
  return <span {...props} className={cn(badgeVariants({ variant }), className)} />
}
