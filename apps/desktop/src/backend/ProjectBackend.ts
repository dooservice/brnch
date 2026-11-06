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
}
