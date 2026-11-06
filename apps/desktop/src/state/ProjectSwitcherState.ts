import type { ProjectBackend } from "../backend/ProjectBackend";
import type { ProjectSummary } from "../model/ProjectSummary";
import type { WorkspaceSummary } from "../model/WorkspaceSummary";

type StateListener = () => void;

/**
 * What the project switcher shows. Switching saves the layout of the project being left and
 * loads the one being entered, so each project comes back as it was.
 */
export class ProjectSwitcherState {
  projects: ProjectSummary[] = [];
  activeProjectIdentifier: string | null = null;
  workspaces: WorkspaceSummary[] = [];
  activeLayoutJson: string | null = null;

  private readonly listeners = new Set<StateListener>();

  constructor(private readonly backend: ProjectBackend) {}

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async load(): Promise<void> {
    this.projects = await this.backend.listProjects();
    this.activeProjectIdentifier = await this.backend.activeProjectIdentifier();
    await this.loadActiveProjectDetails();
    this.announce();
  }

  async addProject(name: string, repositoryUrl: string): Promise<void> {
    const created = await this.backend.addProject(name, repositoryUrl);
    await this.switchTo(created.identifier);
  }

  async switchTo(identifier: string): Promise<void> {
    await this.saveActiveLayout();
    await this.backend.activateProject(identifier);
    this.projects = await this.backend.listProjects();
    this.activeProjectIdentifier = identifier;
    await this.loadActiveProjectDetails();
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

  private async loadActiveProjectDetails(): Promise<void> {
    if (this.activeProjectIdentifier === null) {
      this.workspaces = [];
      this.activeLayoutJson = null;
      return;
    }
    this.workspaces = await this.backend.listWorkspaces(this.activeProjectIdentifier);
    this.activeLayoutJson = await this.backend.loadView(this.activeProjectIdentifier);
  }

  private announce(): void {
    this.listeners.forEach((listener) => listener());
  }
}
