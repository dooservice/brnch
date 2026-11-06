import { GitBranch, Search } from "lucide-react";
import { useEffect, useState } from "react";

import type { ProjectSwitcherState } from "../state/ProjectSwitcherState";
import { useProjectSwitcher } from "../state/useProjectSwitcher";
import { AddProjectDialog } from "./AddProjectDialog";
import { CommandPalette } from "./CommandPalette";
import { ProjectSidebar } from "./ProjectSidebar";
import { WorkspaceView } from "./WorkspaceView";

/** The window: top bar, project sidebar, the active workspace and a status bar. */
export function AppShell({ state }: { readonly state: ProjectSwitcherState }) {
  useProjectSwitcher(state);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    void state.load();
  }, [state]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openAddProject = () => setAddOpen(true);
  const workspaceCount = state.workspaces.length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-9 items-center gap-3 border-b border-line bg-side px-3">
        <span className="flex items-center gap-2 font-bold"><GitBranch size={16} />brnch</span>
        <div className="flex flex-1 justify-center">
          <button type="button" onClick={() => setPaletteOpen(true)} className="flex h-6 w-96 items-center gap-2 rounded-md border border-line px-2.5 text-muted hover:text-ink">
            <Search size={14} />
            <span className="flex-1 text-left">Buscar proyectos y workspaces</span>
            <kbd className="rounded border border-line px-1.5 font-mono text-[10.5px]">Ctrl K</kbd>
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <ProjectSidebar state={state} onAddProject={openAddProject} onSearch={() => setPaletteOpen(true)} />
        <WorkspaceView state={state} />
      </div>
      <footer className="flex h-6 items-center gap-4 border-t border-line bg-side px-3 text-[11.5px] text-muted">
        <span>{state.projects.length} proyectos</span>
        <span>{workspaceCount} workspaces en el proyecto activo</span>
      </footer>
      <CommandPalette state={state} open={paletteOpen} onOpenChange={setPaletteOpen} onAddProject={openAddProject} />
      <AddProjectDialog state={state} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
