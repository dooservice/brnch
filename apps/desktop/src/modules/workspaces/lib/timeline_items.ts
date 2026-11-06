import type { TimelineEntry } from '../types/workspace.types'

export type TimelineItem =
  | { type: 'user'; key: number; text: string }
  | { type: 'session'; key: number; modelName: string }
  | { type: 'message'; key: number; text: string }
  | { type: 'tool'; key: number; name: string; summary: string; status: 'running' | 'done' | 'failed' }
  | { type: 'finished'; key: number; succeeded: boolean; summary: string; cost: number | null; seconds: number | null }
  | { type: 'unparsed'; key: number; rawLine: string }

/** Turns raw events into what the timeline draws: a tool request and its result become one row. */
export function buildTimelineItems(entries: readonly TimelineEntry[]): TimelineItem[] {
  const items: TimelineItem[] = []
  const toolRows = new Map<string, number>()
  for (const { sequence, event } of entries) {
    switch (event.kind) {
      case 'user_message':
        items.push({ type: 'user', key: sequence, text: event.text })
        break
      case 'session_started':
        items.push({ type: 'session', key: sequence, modelName: event.model_name })
        break
      case 'assistant_text':
        items.push({ type: 'message', key: sequence, text: event.text })
        break
      case 'tool_requested':
        toolRows.set(event.tool_call_identifier, items.length)
        items.push({ type: 'tool', key: sequence, name: event.tool_name, summary: event.input_summary, status: 'running' })
        break
      case 'tool_completed': {
        const row = toolRows.get(event.tool_call_identifier)
        const item = row === undefined ? undefined : items[row]
        if (item?.type === 'tool') item.status = event.failed ? 'failed' : 'done'
        break
      }
      case 'run_finished':
        items.push({
          type: 'finished',
          key: sequence,
          succeeded: event.succeeded,
          summary: event.summary,
          cost: event.cost_in_dollars,
          seconds: event.duration_in_milliseconds === null ? null : event.duration_in_milliseconds / 1000,
        })
        break
      case 'unparsed_output':
        items.push({ type: 'unparsed', key: sequence, rawLine: event.raw_line })
        break
    }
  }
  return items
}
