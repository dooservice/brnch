import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type { RunNotice, StartRunRequest } from "../model/AgentEvent";

import type { ProjectSummary } from "../model/ProjectSummary";
import type { WorkspaceSummary } from "../model/WorkspaceSummary";
import type { ProjectBackend } from "./ProjectBackend";

/** Talks to the Rust commands registered in src-tauri. */
export class TauriProjectBackend implements ProjectBackend {
  listProjects(): Promise<ProjectSummary[]> {
    return invoke("list_projects");
  }

  activeProjectIdentifier(): Promise<string | null> {
    return invoke("active_project_identifier");
  }

  addProject(name: string, repositoryUrl: string): Promise<ProjectSummary> {
    return invoke("add_project", { name, repositoryUrl });
  }

  activateProject(identifier: string): Promise<void> {
    return invoke("activate_project", { identifier });
  }

  removeProject(identifier: string): Promise<void> {
    return invoke("remove_project", { identifier });
  }

  listWorkspaces(projectIdentifier: string): Promise<WorkspaceSummary[]> {
    return invoke("list_workspaces", { projectIdentifier });
  }

  loadView(projectIdentifier: string): Promise<string | null> {
    return invoke("load_view", { projectIdentifier });
  }

  saveView(projectIdentifier: string, layoutJson: string): Promise<void> {
    return invoke("save_view", { projectIdentifier, layoutJson });
  }

  startRun(request: StartRunRequest): Promise<string[]> {
    return invoke("start_run", { request });
  }

  listWorkspaceEvents(workspaceIdentifier: string, afterSequence: number): Promise<RunNotice[]> {
    return invoke("list_workspace_events", { workspaceIdentifier, afterSequence });
  }

  onAgentEvent(listener: (notice: RunNotice) => void): Promise<() => void> {
    return listen<RunNotice>("agent-event", (event) => listener(event.payload));
  }
}
