import * as Dialog from "@radix-ui/react-dialog";
import { CircleCheck, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { ConflictSummary } from "../model/Review";
import type { ProjectSwitcherState } from "../state/ProjectSwitcherState";
import type { ReviewState } from "../state/ReviewState";

interface ConflictsDialogProps {
  readonly state: ProjectSwitcherState;
  readonly review: ReviewState;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

type Result = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; conflicts: ConflictSummary[] };

/** Which of the project's agents would not merge with each other, decided by gitd. */
export function ConflictsDialog({ state, review, open, onOpenChange }: ConflictsDialogProps) {
  const [result, setResult] = useState<Result>({ status: "loading" });
  const projectIdentifier = state.activeProjectIdentifier;

  useEffect(() => {
    if (!open || projectIdentifier === null) {
      return;
    }
    let cancelled = false;
    setResult({ status: "loading" });
    review
      .findConflicts(projectIdentifier)
      .then((conflicts) => !cancelled && setResult({ status: "ready", conflicts }))
      .catch((error: unknown) => !cancelled && setResult({ status: "failed", message: String(error) }));
    return () => {
      cancelled = true;
    };
  }, [open, projectIdentifier, review]);

  const branchOf = (identifier: string) => state.workspaces.find((workspace) => workspace.identifier === identifier)?.branchName ?? identifier;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/65" />
        <Dialog.Content className="fixed top-24 left-1/2 w-150 -translate-x-1/2 rounded-xl border border-[#33333b] bg-card shadow-2xl">
          <div className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3.5">
            <div className="flex-1">
              <Dialog.Title className="text-base font-semibold">Conflictos entre agentes</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[12px] text-muted">gitd compara las ramas por pares sin ejecutar el código de ningún agente.</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Cerrar" className="text-muted hover:text-ink"><X size={16} /></Dialog.Close>
          </div>
          <div className="px-5 py-4">
            {result.status === "loading" && <p className="text-muted">Comparando las ramas…</p>}
            {result.status === "failed" && <p role="alert" className="text-danger">{result.message}</p>}
            {result.status === "ready" && result.conflicts.length === 0 && (
              <p className="flex items-center gap-2"><CircleCheck size={16} className="text-ok" />Ningún par de ramas choca.</p>
            )}
            {result.status === "ready" && result.conflicts.length > 0 && (
              <ul className="flex flex-col gap-2.5">
                {result.conflicts.map((conflict) => (
                  <li key={`${conflict.firstWorkspaceIdentifier}-${conflict.secondWorkspaceIdentifier}`} className="rounded-lg border border-[#5a2326] bg-[#1c0f10] px-3.5 py-3">
                    <p className="flex items-center gap-2 font-mono text-[12.5px]"><TriangleAlert size={14} className="text-danger" />{branchOf(conflict.firstWorkspaceIdentifier)} ↔ {branchOf(conflict.secondWorkspaceIdentifier)}</p>
                    <p className="mt-1.5 text-[12px] text-muted">Chocan en:</p>
                    <ul className="mt-0.5 font-mono text-[12px]">
                      {conflict.clashingPaths.map((path) => <li key={path}>{path}</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex justify-end border-t border-line px-5 py-3.5">
            <Dialog.Close className="h-8 rounded-md px-3.5 font-medium text-muted hover:text-ink">Cerrar</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
