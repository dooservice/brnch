import { FileText, GitCompareArrows, MessageSquare, SquareTerminal } from "lucide-react";
import { useState } from "react";

import type { ProjectSwitcherState } from "../state/ProjectSwitcherState";

const TABS = [
  { key: "agent", label: "Agente", icon: MessageSquare, empty: "Aquí verás lo que hace el agente de este workspace." },
  { key: "changes", label: "Cambios", icon: GitCompareArrows, empty: "Aquí revisarás el diff de lo que cambió el agente." },
  { key: "files", label: "Archivos", icon: FileText, empty: "Aquí abrirás y editarás los archivos del workspace." },
  { key: "terminal", label: "Terminal", icon: SquareTerminal, empty: "Aquí tendrás una terminal en la carpeta del workspace." },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** The active project's workspace: its header and the four tabs from the design. */
export function WorkspaceView({ state }: { readonly state: ProjectSwitcherState }) {
  const [tab, setTab] = useState<TabKey>("agent");
  const project = state.projects.find((candidate) => candidate.identifier === state.activeProjectIdentifier);
  const workspace = state.selectedWorkspace;

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
        <span className="truncate font-mono text-[12px] text-muted">{workspace ? workspace.directory : project.repositoryUrl}</span>
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
      <section role="tabpanel" className="flex flex-1 items-center justify-center p-8 text-center text-muted">
        {workspace ? current.empty : "Elige un workspace en la barra lateral."}
      </section>
    </main>
  );
}
