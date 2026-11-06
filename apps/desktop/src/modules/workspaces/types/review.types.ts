export interface DiffSummary {
  unifiedDiff: string
  wasTruncated: boolean
}

export interface ConflictSummary {
  firstWorkspaceIdentifier: string
  secondWorkspaceIdentifier: string
  clashingPaths: string[]
}

export interface PublishOutcome {
  workspaceIdentifier: string
  branchName: string | null
  failure: string | null
}
