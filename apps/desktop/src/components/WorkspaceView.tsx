import { FileText, GitCompareArrows, MessageSquare, SquareTerminal } from "lucide-react";
import { Play } from "lucide-react";
import { useEffect, useState } from "react";

import type { ProjectSwitcherState } from "../state/ProjectSwitcherState";
import { useWorkspaceTimeline } from "../state/useWorkspaceTimeline";
import type { WorkspaceTimelineState } from "../state/WorkspaceTimelineState";
import { AgentTimeline } from "./AgentTimeline";

const TABS = [
  { key: "agent", label: "Agente", icon: MessageSquare, empty: "Aquí verás lo que hace el agente de este workspace." },
  { key: "changes", label: "Cambios", icon: GitCompareArrows, empty: "Aquí revisarás el diff de lo que cambió el agente." },
  { key: "files", label: "Archivos", icon: FileText, empty: "Aquí abrirás y editarás los archivos del workspace." },
  { key: "terminal", label: "Terminal", icon: SquareTerminal, empty: "Aquí tendrás una terminal en la carpeta del workspace." },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** The active project's workspace: its header and the four tabs from the design. */
interface WorkspaceViewProps {
  readonly state: ProjectSwitcherState;
  readonly timeline: WorkspaceTimelineState;
  readonly onNewRun: () => void;
}

export function WorkspaceView({ state, timeline, onNewRun }: WorkspaceViewProps) {
  useWorkspaceTimeline(timeline);
  const [tab, setTab] = useState<TabKey>("agent");
  const project = state.projects.find((candidate) => candidate.identifier === state.activeProjectIdentifier);
  const workspace = state.selectedWorkspace;
  const selectedIdentifier = workspace?.identifier ?? null;

  useEffect(() => {
    if (selectedIdentifier !== null) {
      void timeline.loadHistory(selectedIdentifier);
    }
  }, [timeline, selectedIdentifier]);

  if (!project) {
    return (
      <main className="flex flex-1 items-center justify-center text-muted">
        Añade un proyecto para empezar.
      </main>
    );
  }

  const current = TABS.find((candidate) => candidate.key === tab) ?? TABS[0];
  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 items-center gap-2.5 border-b border-line px-4">
        <h1 className="truncate text-[15px] font-semibold">{workspace ? workspace.branchName : project.name}</h1>
        <span className="flex-1 truncate font-mono text-[12px] text-muted">{workspace ? workspace.directory : project.repositoryUrl}</span>
        <button type="button" onClick={onNewRun} className="flex h-7 items-center gap-1.5 rounded-md bg-ink px-3 font-medium text-canvas"><Play size={13} />Nueva corrida</button>
      </header>
      <div role="tablist" className="flex h-9.5 items-end gap-0.5 border-b border-line px-3">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={key === tab}
            onClick={() => setTab(key)}
            className={`flex h-9 items-center gap-1.5 px-3 font-medium ${key === tab ? "text-ink shadow-[inset_0_-2px_0_var(--color-ink)]" : "text-muted hover:text-ink"}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      <section role="tabpanel" className="flex flex-1 flex-col overflow-y-auto p-6 text-muted">
        {!workspace && <p className="m-auto">Elige un workspace en la barra lateral o lanza una corrida.</p>}
        {workspace && tab === "agent" && <AgentTimeline entries={timeline.eventsOf(workspace.identifier)} />}
        {workspace && tab !== "agent" && <p className="m-auto text-center">{current.empty}</p>}
      </section>
    </main>
  );
}
