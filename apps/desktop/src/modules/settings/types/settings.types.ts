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

/** What the person does on GitHub to sign in. */
export interface GithubLoginPrompt {
  userCode: string
  verificationUrl: string
  loginIdentifier: string
  expiresInSeconds: number
}

export interface GithubLoginResult {
  credential: GitCredential
  installUrl: string
}

/** How far gitd's credentials reach into one repository. */
export interface RepositoryAccess {
  level: 'public' | 'reachable' | 'denied' | 'unknown'
  defaultBranch: string
  failure: string
}

/** The public half of this computer's SSH key. */
export interface SshKey {
  publicKey: string
  fingerprint: string
}

export interface SshVerification {
  access: RepositoryAccess
  enabled: boolean
}
