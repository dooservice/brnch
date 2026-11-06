import type { ProjectBackend } from "../backend/ProjectBackend";
import type { StartRunRequest } from "../model/AgentEvent";
import type { ProjectSummary } from "../model/ProjectSummary";
import type { WorkspaceSummary } from "../model/WorkspaceSummary";

type StateListener = () => void;

/**
 * What the sidebar shows. Switching saves the layout of the project being left and loads the
 * one being entered, so each project comes back as it was.
 */
export class ProjectSwitcherState {
  projects: ProjectSummary[] = [];
  activeProjectIdentifier: string | null = null;
  selectedWorkspaceIdentifier: string | null = null;
  activeLayoutJson: string | null = null;
  private workspacesByProject = new Map<string, WorkspaceSummary[]>();

  private readonly listeners = new Set<StateListener>();

  constructor(private readonly backend: ProjectBackend) {}

  get workspaces(): WorkspaceSummary[] {
    return this.workspacesOf(this.activeProjectIdentifier);
  }

  workspacesOf(projectIdentifier: string | null): WorkspaceSummary[] {
    if (projectIdentifier === null) {
      return [];
    }
    return this.workspacesByProject.get(projectIdentifier) ?? [];
  }

  get selectedWorkspace(): WorkspaceSummary | null {
    return this.workspaces.find((workspace) => workspace.identifier === this.selectedWorkspaceIdentifier) ?? null;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async load(): Promise<void> {
    this.projects = await this.backend.listProjects();
    this.activeProjectIdentifier = await this.backend.activeProjectIdentifier();
    await this.loadWorkspacesOfEveryProject();
    await this.loadActiveLayout();
    this.announce();
  }

  async addProject(name: string, repositoryUrl: string): Promise<void> {
    const created = await this.backend.addProject(name, repositoryUrl);
    await this.switchTo(created.identifier);
  }

  async switchTo(identifier: string): Promise<void> {
    if (identifier !== this.activeProjectIdentifier) {
      await this.saveActiveLayout();
    }
    await this.backend.activateProject(identifier);
    this.projects = await this.backend.listProjects();
    this.activeProjectIdentifier = identifier;
    this.selectedWorkspaceIdentifier = null;
    await this.loadWorkspacesOfEveryProject();
    await this.loadActiveLayout();
    this.announce();
  }

  async selectWorkspace(projectIdentifier: string, workspaceIdentifier: string): Promise<void> {
    await this.switchTo(projectIdentifier);
    this.selectedWorkspaceIdentifier = workspaceIdentifier;
    this.announce();
  }

  /** Starts the agents and shows their new workspaces, selecting the first one. */
  async startRun(request: StartRunRequest): Promise<void> {
    const workspaces = await this.backend.startRun(request);
    await this.loadWorkspacesOfEveryProject();
    this.selectedWorkspaceIdentifier = workspaces[0] ?? null;
    this.announce();
  }

  async removeProject(identifier: string): Promise<void> {
    await this.backend.removeProject(identifier);
    await this.load();
  }

  updateActiveLayout(layoutJson: string): void {
    this.activeLayoutJson = layoutJson;
  }

  async saveActiveLayout(): Promise<void> {
    if (this.activeProjectIdentifier === null || this.activeLayoutJson === null) {
      return;
    }
    await this.backend.saveView(this.activeProjectIdentifier, this.activeLayoutJson);
  }

  private async loadWorkspacesOfEveryProject(): Promise<void> {
    const loaded = new Map<string, WorkspaceSummary[]>();
    for (const project of this.projects) {
      loaded.set(project.identifier, await this.backend.listWorkspaces(project.identifier));
    }
    this.workspacesByProject = loaded;
  }

  private async loadActiveLayout(): Promise<void> {
    this.activeLayoutJson =
      this.activeProjectIdentifier === null
        ? null
        : await this.backend.loadView(this.activeProjectIdentifier);
  }

  private announce(): void {
    this.listeners.forEach((listener) => listener());
  }
}
