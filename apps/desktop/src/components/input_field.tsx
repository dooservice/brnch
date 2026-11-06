import { Children, cloneElement, isValidElement, useId } from 'react'
import { cn } from '@/lib/utils'

interface InputFieldProps {
  label: string
  error?: string | null
  hint?: string
  /** The control the label belongs to, alone or inside a wrapper that draws icons around it. */
  children: React.ReactNode
  className?: string
}

const CONTROLS = new Set(['input', 'select', 'textarea'])

type Linkable = React.ReactElement<{ id?: string; 'aria-describedby'?: string; children?: React.ReactNode }>

/** Gives the first input, select or textarea inside `node` the id and the description link. */
function link(node: React.ReactNode, id: string, describedBy: string | undefined): React.ReactNode {
  return Children.map(node, child => {
    if (!isValidElement(child)) return child
    const element = child as Linkable
    if (typeof element.type === 'string' && CONTROLS.has(element.type)) {
      return cloneElement(element, { id, 'aria-describedby': describedBy })
    }
    if (element.props.children === undefined) return child
    return cloneElement(element, {}, link(element.props.children, id, describedBy))
  })
}

/** A label, its control and the reason it was refused, laid out the same in every form. */
export default function InputField({ label, error, hint, children, className }: InputFieldProps) {
  const id = useId()
  const noteId = `${id}-note`
  const note = error ?? hint

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="font-medium">{label}</label>
      {link(children, id, note ? noteId : undefined)}
      {note && (
        <span id={noteId} role={error ? 'alert' : undefined} className={cn('text-[12px]', error ? 'text-danger' : 'text-muted')}>{note}</span>
      )}
    </div>
  )
}
