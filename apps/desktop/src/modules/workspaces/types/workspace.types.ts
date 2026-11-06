export type WorkspaceStatus = 'idle' | 'running' | 'done' | 'failed'

export interface Workspace {
  identifier: string
  directory: string
  branchName: string
  title: string
  agentLabel: string
  runIdentifier: string | null
  status: WorkspaceStatus
  startedAtMilliseconds: number | null
  costInDollars: number | null
  durationInMilliseconds: number | null
}

/** One thing an agent did. Mirrors the `AgentEvent` the Rust side writes as JSON. */
export type AgentEvent =
  | { kind: 'user_message'; text: string }
  | { kind: 'session_started'; session_identifier: string; model_name: string }
  | { kind: 'assistant_text'; text: string }
  | { kind: 'tool_requested'; tool_call_identifier: string; tool_name: string; input_summary: string }
  | { kind: 'tool_completed'; tool_call_identifier: string; failed: boolean }
  | { kind: 'run_finished'; succeeded: boolean; summary: string; cost_in_dollars: number | null; duration_in_milliseconds: number | null }
  | { kind: 'unparsed_output'; raw_line: string }

/** An event with the position it has in its workspace's history. */
export interface RunNotice {
  workspaceIdentifier: string
  sequence: number
  eventJson: string
}

export interface TimelineEntry {
  sequence: number
  event: AgentEvent
}

/** Workspaces started by one run, shown together so their results can be compared. */
export interface RunGroup {
  runIdentifier: string
  title: string
  workspaces: Workspace[]
}
