import * as React from 'react'
import { componentRegistry } from '../component_registry'

interface SlotProps {
  name: string
  children?: React.ReactNode
}

export function Slot({ name, children }: SlotProps) {
  const entries = componentRegistry.resolve(name)

  const replaceEntry = entries.find(entry => entry.position === 'replace')
  if (replaceEntry) {
    const Replacement = replaceEntry.component
    return <Replacement />
  }

  const before = entries.filter(entry => entry.position === 'before')
  const inside = entries.filter(entry => entry.position === 'inside')
  const after = entries.filter(entry => entry.position === 'after')

  return (
    <>
      {before.map(entry => <entry.component key={entry.id} />)}
      {children}
      {inside.map(entry => <entry.component key={entry.id} />)}
      {after.map(entry => <entry.component key={entry.id} />)}
    </>
  )
}
