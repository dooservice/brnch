export interface DiffSummary {
  readonly unifiedDiff: string;
  readonly wasTruncated: boolean;
}

export interface ConflictSummary {
  readonly firstWorkspaceIdentifier: string;
  readonly secondWorkspaceIdentifier: string;
  readonly clashingPaths: readonly string[];
}

export interface PublishOutcome {
  readonly workspaceIdentifier: string;
  readonly branchName: string | null;
  readonly failure: string | null;
}
