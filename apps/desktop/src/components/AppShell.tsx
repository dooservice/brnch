import { GitBranch, Search } from "lucide-react";
import { useEffect, useState } from "react";

import type { ProjectSwitcherState } from "../state/ProjectSwitcherState";
import { useProjectSwitcher } from "../state/useProjectSwitcher";
import type { ReviewState } from "../state/ReviewState";
import type { WorkspaceTimelineState } from "../state/WorkspaceTimelineState";
import { AddProjectDialog } from "./AddProjectDialog";
import { CommandPalette } from "./CommandPalette";
import { ConflictsDialog } from "./ConflictsDialog";
import { NewRunDialog } from "./NewRunDialog";
import { ProjectSidebar } from "./ProjectSidebar";
import { PublishDialog } from "./PublishDialog";
import { WorkspaceView } from "./WorkspaceView";

/** The window: top bar, project sidebar, the active workspace and a status bar. */
interface AppShellProps {
  readonly state: ProjectSwitcherState;
  readonly timeline: WorkspaceTimelineState;
  readonly review: ReviewState;
}

export function AppShell({ state, timeline, review }: AppShellProps) {
  useProjectSwitcher(state);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  useEffect(() => {
    void state.load();
  }, [state]);

  useEffect(() => {
    void timeline.startListening();
    return () => timeline.stop();
  }, [timeline]);

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
        <WorkspaceView state={state} timeline={timeline} review={review} onNewRun={() => setRunOpen(true)} onCheckConflicts={() => setConflictsOpen(true)} onPublish={() => setPublishOpen(true)} />
      </div>
      <footer className="flex h-6 items-center gap-4 border-t border-line bg-side px-3 text-[11.5px] text-muted">
        <span>{state.projects.length} proyectos</span>
        <span>{workspaceCount} workspaces en el proyecto activo</span>
      </footer>
      <CommandPalette state={state} open={paletteOpen} onOpenChange={setPaletteOpen} onAddProject={openAddProject} />
      <ConflictsDialog state={state} review={review} open={conflictsOpen} onOpenChange={setConflictsOpen} />
      <PublishDialog review={review} open={publishOpen} onOpenChange={setPublishOpen} workspaces={state.selectedWorkspace ? [{ identifier: state.selectedWorkspace.identifier, branchName: state.selectedWorkspace.branchName }] : []} />
      <NewRunDialog state={state} open={runOpen} onOpenChange={setRunOpen} />
      <AddProjectDialog state={state} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
