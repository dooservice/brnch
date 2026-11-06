import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { FolderGit2, GitBranch, Plus, Search } from "lucide-react";

import type { ProjectSwitcherState } from "../state/ProjectSwitcherState";

interface CommandPaletteProps {
  readonly state: ProjectSwitcherState;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAddProject: () => void;
}

/** Ctrl K: jump to any project or workspace, or add a project. */
export function CommandPalette({ state, open, onOpenChange, onAddProject }: CommandPaletteProps) {
  const close = () => onOpenChange(false);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60" />
        <Dialog.Content aria-label="Paleta de comandos" className="fixed top-24 left-1/2 w-150 -translate-x-1/2 overflow-hidden rounded-xl border border-[#33333b] bg-card shadow-2xl">
          <Dialog.Title className="sr-only">Buscar proyectos y workspaces</Dialog.Title>
          <Dialog.Description className="sr-only">Escribe para filtrar y pulsa Enter para abrir.</Dialog.Description>
          <Command>
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search size={16} className="text-muted" />
              <Command.Input placeholder="Buscar proyectos y workspaces" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
            </div>
            <Command.List className="max-h-96 overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-muted">Sin resultados.</Command.Empty>
              <Command.Group heading="Proyectos" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase">
                {state.projects.map((project) => (
                  <Item key={project.identifier} value={`proyecto ${project.name}`} onSelect={() => { void state.switchTo(project.identifier); close(); }}>
                    <FolderGit2 size={14} className="text-muted" />
                    <span className="flex-1">{project.name}</span>
                    <span className="text-[12px] text-muted">{state.workspacesOf(project.identifier).length} workspaces</span>
                  </Item>
                ))}
              </Command.Group>
              <Command.Group heading="Workspaces" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase">
                {state.projects.flatMap((project) =>
                  state.workspacesOf(project.identifier).map((workspace) => (
                    <Item key={workspace.identifier} value={`workspace ${workspace.branchName} ${project.name}`} onSelect={() => { void state.selectWorkspace(project.identifier, workspace.identifier); close(); }}>
                      <GitBranch size={14} className="text-muted" />
                      <span className="flex-1 font-mono text-[12.5px]">{workspace.branchName}</span>
                      <span className="text-[12px] text-muted">{project.name}</span>
                    </Item>
                  )),
                )}
              </Command.Group>
              <Command.Group heading="Acciones" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase">
                <Item value="acción añadir proyecto" onSelect={() => { close(); onAddProject(); }}>
                  <Plus size={14} className="text-muted" />
                  <span className="flex-1">Añadir proyecto…</span>
                </Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Item(props: { value: string; onSelect: () => void; children: React.ReactNode }) {
  return (
    <Command.Item value={props.value} onSelect={props.onSelect} className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 data-[selected=true]:bg-hover">
      {props.children}
    </Command.Item>
  );
}
