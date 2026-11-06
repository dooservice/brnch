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

/** A credential gitd keeps for publishing; the secret itself never reaches the window. */
export interface GitCredential {
  identifier: string
  kind: 'token' | 'ssh_key' | 'github_app' | 'github_login' | 'other'
  urlPrefix: string
  actsAs: string
}
