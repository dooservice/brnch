import * as Dialog from "@radix-ui/react-dialog";
import { CircleCheck, CircleX, Loader2, Lock, X } from "lucide-react";
import { useState } from "react";

import type { PublishOutcome } from "../model/Review";
import type { ReviewState } from "../state/ReviewState";

interface PublishDialogProps {
  readonly review: ReviewState;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly workspaces: readonly { identifier: string; branchName: string }[];
}

/** Publishing is gitd's job: it pushes with the token it holds, the agent never had it. */
export function PublishDialog({ review, open, onOpenChange, workspaces }: PublishDialogProps) {
  const [outcomes, setOutcomes] = useState<PublishOutcome[] | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const close = (next: boolean) => {
    if (!next) {
      setOutcomes(null);
      setFailure(null);
    }
    onOpenChange(next);
  };

  const publish = async () => {
    setPublishing(true);
    setFailure(null);
    try {
      setOutcomes(await review.publish(workspaces.map((workspace) => workspace.identifier)));
    } catch (error) {
      setFailure(String(error));
    } finally {
      setPublishing(false);
    }
  };
  const branchOf = (identifier: string) => workspaces.find((workspace) => workspace.identifier === identifier)?.branchName ?? identifier;

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/65" />
        <Dialog.Content className="fixed top-24 left-1/2 w-140 -translate-x-1/2 rounded-xl border border-[#33333b] bg-card shadow-2xl">
          <div className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3.5">
            <div className="flex-1">
              <Dialog.Title className="text-base font-semibold">Publicar {workspaces.length === 1 ? "la rama" : `${workspaces.length} ramas`}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[12px] text-muted">gitd empuja cada rama con el token que guarda. El agente nunca lo recibió.</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Cerrar" className="text-muted hover:text-ink"><X size={16} /></Dialog.Close>
          </div>
          <ul className="flex flex-col gap-2 px-5 py-4">
            {workspaces.map((workspace) => {
              const outcome = outcomes?.find((candidate) => candidate.workspaceIdentifier === workspace.identifier);
              return (
                <li key={workspace.identifier} className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2.5">
                  {!outcome && (publishing ? <Loader2 size={16} className="mt-0.5 animate-spin text-warn" aria-label="Publicando" /> : <Lock size={16} className="mt-0.5 text-muted" />)}
                  {outcome?.failure === null && <CircleCheck size={16} className="mt-0.5 text-ok" aria-label="Publicada" />}
                  {outcome && outcome.failure !== null && <CircleX size={16} className="mt-0.5 text-danger" aria-label="No se publicó" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[12.5px]">{branchOf(workspace.identifier)}</p>
                    {outcome?.failure && <p role="alert" className="mt-0.5 text-[12.5px] text-danger">{outcome.failure}</p>}
                    {outcome?.branchName && <p className="mt-0.5 text-[12px] text-muted">Publicada como {outcome.branchName}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          {failure && <p role="alert" className="mx-5 mb-3 rounded-md border border-[#5a2326] bg-[#1c0f10] px-3 py-2 text-[12.5px] text-danger">{failure}</p>}
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">
            <Dialog.Close className="h-8 rounded-md px-3.5 font-medium text-muted hover:text-ink">{outcomes ? "Cerrar" : "Cancelar"}</Dialog.Close>
            {!outcomes && (
              <button type="button" onClick={() => void publish()} disabled={publishing} className="h-8 rounded-md bg-ink px-3.5 font-medium text-canvas disabled:opacity-60">
                {publishing ? "Publicando…" : "Publicar"}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
