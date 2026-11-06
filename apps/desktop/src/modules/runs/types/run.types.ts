export type PermissionMode = 'edit_files' | 'plan_only'

export interface StartRunInput {
  projectIdentifier: string
  runLabel: string
  prompt: string
  agentKind: 'claude_code'
  permissionMode: PermissionMode
  baseBranch: string | null
  copies: number
  maximumMinutes: number | null
}
