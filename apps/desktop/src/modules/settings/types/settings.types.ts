export interface SandboxStatus {
  available: boolean
  mechanism: string
  reason: string | null
}

export interface AgentInstallation {
  kind: 'claude_code'
  installed: boolean
  version: string | null
}

export interface GitdStatus {
  connected: boolean
  message: string | null
}

/** What measuring a confined agent found, with a real process. */
export interface SandboxProbeReport {
  homeHidden: boolean
  workspaceWritable: boolean
  failure: string | null
}
