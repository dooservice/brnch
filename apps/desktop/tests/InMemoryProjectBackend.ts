import type { RunNotice, StartRunRequest } from "../src/model/AgentEvent";
import type { ConflictSummary, DiffSummary, PublishOutcome } from "../src/model/Review";
import type { ProjectBackend } from "../src/backend/ProjectBackend";
import type { ProjectSummary } from "../src/model/ProjectSummary";
import type { WorkspaceSummary } from "../src/model/WorkspaceSummary";

/** Remembers projects and layouts in memory, like the Rust store does on disk. */
export class InMemoryProjectBackend implements ProjectBackend {
  private readonly projects: ProjectSummary[] = [];
  private readonly layouts = new Map<string, string>();
  private active: string | null = null;
  private counter = 0;

  async listProjects(): Promise<ProjectSummary[]> {
    return [...this.projects];
  }

  async activeProjectIdentifier(): Promise<string | null> {
    return this.active;
  }

  async addProject(name: string, repositoryUrl: string): Promise<ProjectSummary> {
    this.counter += 1;
    const created = { identifier: `project-${this.counter}`, name, repositoryUrl };
    this.projects.push(created);
    return created;
  }

  async activateProject(identifier: string): Promise<void> {
    this.active = identifier;
  }

  async removeProject(identifier: string): Promise<void> {
    const position = this.projects.findIndex((project) => project.identifier === identifier);
    this.projects.splice(position, 1);
    this.active = this.active === identifier ? null : this.active;
  }

  async listWorkspaces(projectIdentifier: string): Promise<WorkspaceSummary[]> {
    return [{ identifier: `workspace-of-${projectIdentifier}`, directory: `/work/${projectIdentifier}`, branchName: `agents/${projectIdentifier}` }];
  }

  async loadView(projectIdentifier: string): Promise<string | null> {
    return this.layouts.get(projectIdentifier) ?? null;
  }

  async saveView(projectIdentifier: string, layoutJson: string): Promise<void> {
    this.layouts.set(projectIdentifier, layoutJson);
  }

  readonly startedRuns: StartRunRequest[] = [];
  private readonly history = new Map<string, RunNotice[]>();
  private liveListener: ((notice: RunNotice) => void) | null = null;

  async startRun(request: StartRunRequest): Promise<string[]> {
    this.startedRuns.push(request);
    return [`workspace-of-${request.projectIdentifier}`];
  }

  seedHistory(workspaceIdentifier: string, notices: RunNotice[]): void {
    this.history.set(workspaceIdentifier, notices);
  }

  emitLive(notice: RunNotice): void {
    this.liveListener?.(notice);
  }

  async listWorkspaceEvents(workspaceIdentifier: string, afterSequence: number): Promise<RunNotice[]> {
    return (this.history.get(workspaceIdentifier) ?? []).filter((notice) => notice.sequence > afterSequence);
  }

  async onAgentEvent(listener: (notice: RunNotice) => void): Promise<() => void> {
    this.liveListener = listener;
    return () => {
      this.liveListener = null;
    };
  }

  diffs = new Map<string, DiffSummary>();
  conflicts: ConflictSummary[] = [];
  readonly publishedBatches: string[][] = [];
  publishFailure: string | null = null;

  async readWorkspaceDiff(workspaceIdentifier: string): Promise<DiffSummary> {
    return this.diffs.get(workspaceIdentifier) ?? { unifiedDiff: "", wasTruncated: false };
  }

  async findProjectConflicts(): Promise<ConflictSummary[]> {
    return this.conflicts;
  }

  async publishWorkspaces(workspaceIdentifiers: string[]): Promise<PublishOutcome[]> {
    this.publishedBatches.push(workspaceIdentifiers);
    return workspaceIdentifiers.map((workspaceIdentifier) => ({
      workspaceIdentifier,
      branchName: this.publishFailure === null ? `agents/${workspaceIdentifier}` : null,
      failure: this.publishFailure,
    }));
  }
}
