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
    return [{ identifier: `workspace-of-${projectIdentifier}`, directory: `/work/${projectIdentifier}`, branchName: "agents/x" }];
  }

  async loadView(projectIdentifier: string): Promise<string | null> {
    return this.layouts.get(projectIdentifier) ?? null;
  }

  async saveView(projectIdentifier: string, layoutJson: string): Promise<void> {
    this.layouts.set(projectIdentifier, layoutJson);
  }
}
