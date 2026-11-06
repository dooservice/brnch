import type * as React from 'react'
import type { InheritPosition, SlotEntry } from './types'

interface InheritSpec {
  slot: string
  position: InheritPosition
  component: React.ComponentType
  priority?: number
}

class ComponentRegistry {
  private readonly entries: SlotEntry[] = []
  private idCounter = 0

  inherit(spec: InheritSpec): void {
    this.idCounter += 1
    this.entries.push({
      id: `slot-${this.idCounter}`,
      slot: spec.slot,
      position: spec.position,
      component: spec.component,
      priority: spec.priority ?? 0,
    })
  }

  resolve(slotName: string): SlotEntry[] {
    return this.entries
      .filter(entry => entry.slot === slotName)
      .sort((first, second) => second.priority - first.priority)
  }

  getAllSlots(): string[] {
    return [...new Set(this.entries.map(entry => entry.slot))]
  }
}

export { ComponentRegistry }
export const componentRegistry = new ComponentRegistry()
