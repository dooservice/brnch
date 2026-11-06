import { describe, expect, it } from "vitest";

import type { ProjectBackend } from "../src/backend/ProjectBackend";
import type { ProjectSummary } from "../src/model/ProjectSummary";
import type { WorkspaceSummary } from "../src/model/WorkspaceSummary";
import { ProjectSwitcherState } from "../src/state/ProjectSwitcherState";

/** Remembers projects and layouts in memory, like the Rust store does on disk. */
class InMemoryProjectBackend implements ProjectBackend {
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
    return [{ identifier: "w", directory: `/work/${projectIdentifier}`, branchName: "agents/x" }];
  }

  async loadView(projectIdentifier: string): Promise<string | null> {
    return this.layouts.get(projectIdentifier) ?? null;
  }

  async saveView(projectIdentifier: string, layoutJson: string): Promise<void> {
    this.layouts.set(projectIdentifier, layoutJson);
  }
}

describe("ProjectSwitcherState", () => {
  it("brings each project back with the layout it was left with", async () => {
    const state = new ProjectSwitcherState(new InMemoryProjectBackend());
    await state.load();
    await state.addProject("first", "https://example.com/a");
    state.updateActiveLayout('{"tabs":["a.rs"]}');
    await state.addProject("second", "https://example.com/b");
    expect(state.activeLayoutJson).toBeNull();

    await state.switchTo("project-1");

    expect(state.activeProjectIdentifier).toBe("project-1");
    expect(state.activeLayoutJson).toBe('{"tabs":["a.rs"]}');
    expect(state.workspaces[0]?.directory).toBe("/work/project-1");
  });

  it("tells subscribers once per change and stops after unsubscribing", async () => {
    const state = new ProjectSwitcherState(new InMemoryProjectBackend());
    let announcements = 0;
    const stop = state.subscribe(() => (announcements += 1));

    await state.addProject("only", "https://example.com/a");
    stop();
    await state.addProject("other", "https://example.com/b");

    expect(announcements).toBe(1);
  });

  it("shows no workspaces after the active project is removed", async () => {
    const state = new ProjectSwitcherState(new InMemoryProjectBackend());
    await state.addProject("only", "https://example.com/a");

    await state.removeProject("project-1");

    expect(state.activeProjectIdentifier).toBeNull();
    expect(state.workspaces).toEqual([]);
    expect(state.projects).toEqual([]);
  });
});
