import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import Spinner from '@/components/spinner'
import { cn } from '@/lib/utils'

const buttonVariants = cva('', {
  variants: {
    variant: {
      default: 'btn-primary',
      outline: 'btn-secondary',
      destructive: 'btn-red',
      ghost: 'btn-ghost',
    },
  },
  defaultVariants: { variant: 'default' },
})

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean
  icon?: React.ReactNode
}

export default function Button({ children, disabled, loading, variant, className, icon, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} disabled={loading || disabled} {...props} className={cn(buttonVariants({ variant }), className)}>
      {loading ? <Spinner className="h-3.5 w-3.5 shrink-0 animate-spin" /> : icon}
      {children != null && children !== false && <span className="whitespace-nowrap">{children}</span>}
    </button>
  )
}
