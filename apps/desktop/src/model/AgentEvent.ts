/** One thing an agent did. Mirrors the `AgentEvent` the Rust side writes as JSON. */
export type AgentEvent =
  | { kind: "session_started"; session_identifier: string; model_name: string }
  | { kind: "assistant_text"; text: string }
  | { kind: "tool_requested"; tool_call_identifier: string; tool_name: string; input_summary: string }
  | { kind: "tool_completed"; tool_call_identifier: string; failed: boolean }
  | {
      kind: "run_finished";
      succeeded: boolean;
      summary: string;
      cost_in_dollars: number | null;
      duration_in_milliseconds: number | null;
    }
  | { kind: "unparsed_output"; raw_line: string };

/** An event with the position it has in its workspace's history. */
export interface RunNotice {
  readonly workspaceIdentifier: string;
  readonly sequence: number;
  readonly eventJson: string;
}

export interface StartRunRequest {
  readonly projectIdentifier: string;
  readonly runLabel: string;
  readonly prompt: string;
  readonly agentKind: "claude_code";
  readonly copies: number;
}
