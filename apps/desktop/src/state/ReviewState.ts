import type { ProjectBackend } from "../backend/ProjectBackend";
import type { ConflictSummary, DiffSummary, PublishOutcome } from "../model/Review";

/** What the window asks of gitd to review work: the diff, the conflicts and publishing. */
export class ReviewState {
  constructor(private readonly backend: ProjectBackend) {}

  readDiff(workspaceIdentifier: string): Promise<DiffSummary> {
    return this.backend.readWorkspaceDiff(workspaceIdentifier);
  }

  findConflicts(projectIdentifier: string): Promise<ConflictSummary[]> {
    return this.backend.findProjectConflicts(projectIdentifier);
  }

  publish(workspaceIdentifiers: string[]): Promise<PublishOutcome[]> {
    return this.backend.publishWorkspaces(workspaceIdentifiers);
  }
}
