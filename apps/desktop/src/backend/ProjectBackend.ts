import type { RunNotice, StartRunRequest } from "../model/AgentEvent";
import type { ConflictSummary, DiffSummary, PublishOutcome } from "../model/Review";
import type { ProjectSummary } from "../model/ProjectSummary";
import type { WorkspaceSummary } from "../model/WorkspaceSummary";

/** Everything the interface asks of the Rust side about projects. */
export interface ProjectBackend {
  listProjects(): Promise<ProjectSummary[]>;
  activeProjectIdentifier(): Promise<string | null>;
  addProject(name: string, repositoryUrl: string): Promise<ProjectSummary>;
  activateProject(identifier: string): Promise<void>;
  removeProject(identifier: string): Promise<void>;
  listWorkspaces(projectIdentifier: string): Promise<WorkspaceSummary[]>;
  loadView(projectIdentifier: string): Promise<string | null>;
  saveView(projectIdentifier: string, layoutJson: string): Promise<void>;
  readWorkspaceDiff(workspaceIdentifier: string): Promise<DiffSummary>;
  findProjectConflicts(projectIdentifier: string): Promise<ConflictSummary[]>;
  publishWorkspaces(workspaceIdentifiers: string[]): Promise<PublishOutcome[]>;
  startRun(request: StartRunRequest): Promise<string[]>;
  listWorkspaceEvents(workspaceIdentifier: string, afterSequence: number): Promise<RunNotice[]>;
  /** Calls the listener for every new agent event; returns a function that stops listening. */
  onAgentEvent(listener: (notice: RunNotice) => void): Promise<() => void>;
}
