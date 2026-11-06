import * as Dialog from "@radix-ui/react-dialog";
import { Bot, Minus, Plus, GitBranch, X } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import type { ProjectSwitcherState } from "../state/ProjectSwitcherState";

const MAXIMUM_COPIES = 4;
const LABEL_WORDS = 6;

/** The run's name, which becomes its branch, comes from the first words of the task. */
export function deriveRunLabel(prompt: string): string {
  return prompt.trim().split(/\s+/).slice(0, LABEL_WORDS).join(" ");
}

interface NewRunDialogProps {
  readonly state: ProjectSwitcherState;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** "Nueva corrida": one task, handed to one or several copies of an agent. */
export function NewRunDialog({ state, open, onOpenChange }: NewRunDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [copies, setCopies] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const project = state.projects.find((candidate) => candidate.identifier === state.activeProjectIdentifier);
  const promptInvalid = submitted && prompt.trim() === "";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!project || prompt.trim() === "") {
      return;
    }
    setStarting(true);
    setFailure(null);
    try {
      await state.startRun({
        projectIdentifier: project.identifier,
        runLabel: deriveRunLabel(prompt),
        prompt: prompt.trim(),
        agentKind: "claude_code",
        copies,
      });
      setPrompt("");
      setCopies(1);
      setSubmitted(false);
      onOpenChange(false);
    } catch (error) {
      setFailure(String(error));
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/65" />
        <Dialog.Content className="fixed top-16 left-1/2 w-170 -translate-x-1/2 rounded-xl border border-[#33333b] bg-card shadow-2xl">
          <form onSubmit={submit} noValidate>
            <div className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3.5">
              <div className="flex-1">
                <Dialog.Title className="text-base font-semibold">Nueva corrida</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-[12px] text-muted">
                  Describe la tarea una vez. Cada copia del agente trabaja en su propio workspace de gitd.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Cerrar" className="text-muted hover:text-ink"><X size={16} /></Dialog.Close>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">Proyecto</span>
                <div className="flex h-8.5 items-center rounded-md border border-line bg-canvas px-2.5 text-muted">{project?.name ?? "Sin proyecto activo"}</div>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Tarea</span>
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  aria-invalid={promptInvalid}
                  rows={4}
                  autoFocus
                  placeholder="Añade una búsqueda por nombre al catálogo, con pruebas."
                  className={`resize-none rounded-md border bg-canvas px-3 py-2 leading-relaxed outline-none focus:border-[#55555f] ${promptInvalid ? "border-danger" : "border-line"}`}
                />
                {promptInvalid && <span role="alert" className="text-[12px] text-danger">Describe la tarea.</span>}
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium">Agente</span>
                <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                  <Bot size={16} className="text-muted" />
                  <div className="flex-1">
                    <p className="font-medium">Claude Code</p>
                    <p className="text-[12px] text-muted">Otros agentes se añadirán cuando se verifique su salida.</p>
                  </div>
                  <div className="flex h-7 items-center rounded-md border border-line" role="group" aria-label="Copias">
                    <button type="button" aria-label="Menos copias" disabled={copies <= 1} onClick={() => setCopies(copies - 1)} className="flex w-7 justify-center text-muted disabled:opacity-40"><Minus size={14} /></button>
                    <output aria-label="Número de copias" className="w-6 text-center font-mono">{copies}</output>
                    <button type="button" aria-label="Más copias" disabled={copies >= MAXIMUM_COPIES} onClick={() => setCopies(copies + 1)} className="flex w-7 justify-center text-muted disabled:opacity-40"><Plus size={14} /></button>
                  </div>
                </div>
              </div>
              {failure && <p role="alert" className="rounded-md border border-[#5a2326] bg-[#1c0f10] px-3 py-2 text-[12.5px] text-danger">{failure}</p>}
            </div>
            <div className="flex items-center gap-2.5 border-t border-line px-5 py-3.5">
              <span className="flex flex-1 items-center gap-2 text-[12px] text-muted"><GitBranch size={14} />Se crearán {copies} workspace{copies === 1 ? "" : "s"}</span>
              <Dialog.Close className="h-8 rounded-md px-3.5 font-medium text-muted hover:text-ink">Cancelar</Dialog.Close>
              <button type="submit" disabled={starting || !project} className="h-8 rounded-md bg-ink px-3.5 font-medium text-canvas disabled:opacity-60">
                {starting ? "Lanzando…" : `Lanzar ${copies} ${copies === 1 ? "agente" : "agentes"}`}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
