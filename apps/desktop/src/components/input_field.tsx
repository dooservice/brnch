import { cloneElement, isValidElement, useId } from 'react'
import { cn } from '@/lib/utils'

interface InputFieldProps {
  label: string
  error?: string | null
  hint?: string
  /** The one control the label belongs to; it receives the id and the description links. */
  children: React.ReactElement<{ id?: string; 'aria-describedby'?: string }>
  className?: string
}

/** A label, its control and the reason it was refused, laid out the same in every form. */
export default function InputField({ label, error, hint, children, className }: InputFieldProps) {
  const id = useId()
  const noteId = `${id}-note`
  const note = error ?? hint
  const control = isValidElement(children) ? cloneElement(children, { id, 'aria-describedby': note ? noteId : undefined }) : children

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="font-medium">{label}</label>
      {control}
      {note && (
        <span id={noteId} role={error ? 'alert' : undefined} className={cn('text-[12px]', error ? 'text-danger' : 'text-muted')}>{note}</span>
      )}
    </div>
  )
}
