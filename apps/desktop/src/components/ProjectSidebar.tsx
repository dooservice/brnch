import { ChevronDown, ChevronRight, FolderGit2, GitBranch, Plus, Search } from "lucide-react";
import { useState } from "react";

import type { ProjectSwitcherState } from "../state/ProjectSwitcherState";

interface ProjectSidebarProps {
  readonly state: ProjectSwitcherState;
  readonly onAddProject: () => void;
  readonly onSearch: () => void;
}

/** Every project with its workspaces. One click anywhere changes the whole context. */
export function ProjectSidebar({ state, onAddProject, onSearch }: ProjectSidebarProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggle = (identifier: string) => {
    const next = new Set(collapsed);
    if (!next.delete(identifier)) {
      next.add(identifier);
    }
    setCollapsed(next);
  };

  return (
    <nav aria-label="Proyectos" className="flex w-70 shrink-0 flex-col border-r border-line bg-side">
      <div className="flex items-center justify-between py-3 pr-3 pl-3.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
        <span>Proyectos</span>
        <span className="flex gap-0.5">
          <IconButton label="Buscar" onClick={onSearch}>
            <Search size={14} />
          </IconButton>
          <IconButton label="Añadir proyecto" onClick={onAddProject}>
            <Plus size={14} />
          </IconButton>
        </span>
      </div>
      <div className="flex-1 overflow-y-auto pb-3">
        {state.projects.length === 0 && (
          <p className="px-4 py-3 text-muted">Aún no hay proyectos. Añade el primero con el botón +.</p>
        )}
        {state.projects.map((project) => {
          const isCollapsed = collapsed.has(project.identifier);
          const workspaces = state.workspacesOf(project.identifier);
          const isActive = project.identifier === state.activeProjectIdentifier;
          return (
            <div key={project.identifier}>
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => {
                  toggle(project.identifier);
                  if (!isActive) {
                    void state.switchTo(project.identifier);
                  }
                }}
                className="mx-1.5 flex w-[calc(100%-12px)] items-center gap-2 rounded-md px-3 py-1.5 text-left font-medium hover:bg-hover"
              >
                {isCollapsed ? <ChevronRight size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
                <FolderGit2 size={14} className={isActive ? "text-ink" : "text-muted"} />
                <span className="flex-1 truncate">{project.name}</span>
                <span className="text-[11px] text-muted">{workspaces.length}</span>
              </button>
              {!isCollapsed &&
                workspaces.map((workspace) => {
                  const isSelected = isActive && workspace.identifier === state.selectedWorkspaceIdentifier;
                  return (
                    <button
                      key={workspace.identifier}
                      type="button"
                      aria-current={isSelected}
                      onClick={() => void state.selectWorkspace(project.identifier, workspace.identifier)}
                      className={`mx-1.5 my-px flex w-[calc(100%-12px)] items-center gap-2.5 rounded-md py-1.5 pr-2.5 pl-8 text-left hover:bg-hover ${isSelected ? "bg-hover text-ink" : "text-[#c4c4cc]"}`}
                    >
                      <GitBranch size={14} className="text-muted" />
                      <span className="truncate font-mono text-[12px]">{workspace.branchName}</span>
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function IconButton(props: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      className="flex size-6 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink"
    >
      {props.children}
    </button>
  );
}
