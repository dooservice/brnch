import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import type { ProjectSwitcherState } from "../state/ProjectSwitcherState";

interface AddProjectDialogProps {
  readonly state: ProjectSwitcherState;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

function validRepositoryUrl(value: string): boolean {
  try {
    return ["http:", "https:", "ssh:"].includes(new URL(value).protocol);
  } catch {
    return /^[\w.-]+@[\w.-]+:.+/.test(value);
  }
}

/** Asks for the two things a project needs today: a name and where its repository lives. */
export function AddProjectDialog({ state, open, onOpenChange }: AddProjectDialogProps) {
  const [name, setName] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const urlInvalid = submitted && !validRepositoryUrl(repositoryUrl.trim());
  const nameInvalid = submitted && name.trim() === "";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (name.trim() === "" || !validRepositoryUrl(repositoryUrl.trim())) {
      return;
    }
    await state.addProject(name.trim(), repositoryUrl.trim());
    setName("");
    setRepositoryUrl("");
    setSubmitted(false);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/65" />
        <Dialog.Content className="fixed top-24 left-1/2 w-140 -translate-x-1/2 rounded-xl border border-[#33333b] bg-card shadow-2xl">
          <form onSubmit={submit} noValidate>
            <div className="flex items-start gap-3 border-b border-line px-5 pt-4 pb-3.5">
              <div className="flex-1">
                <Dialog.Title className="text-base font-semibold">Añadir proyecto</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-[12px] text-muted">
                  Cada proyecto guarda su propio contexto: workspaces y lo que tenías abierto.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Cerrar" className="text-muted hover:text-ink">
                <X size={16} />
              </Dialog.Close>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4">
              <Field label="Nombre" error={nameInvalid ? "Escribe un nombre." : null}>
                <input value={name} onChange={(event) => setName(event.target.value)} aria-invalid={nameInvalid} className={inputClass(nameInvalid)} autoFocus />
              </Field>
              <Field label="URL del repositorio" error={urlInvalid ? "Usa una URL https, ssh o git@host:ruta." : null}>
                <input value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} aria-invalid={urlInvalid} placeholder="https://github.com/acme/web-store" className={`${inputClass(urlInvalid)} font-mono text-[12.5px]`} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">
              <Dialog.Close className="h-8 rounded-md px-3.5 font-medium text-muted hover:text-ink">Cancelar</Dialog.Close>
              <button type="submit" className="h-8 rounded-md bg-ink px-3.5 font-medium text-canvas">Añadir proyecto</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function inputClass(invalid: boolean): string {
  return `h-8.5 rounded-md border bg-canvas px-2.5 outline-none focus:border-[#55555f] ${invalid ? "border-danger" : "border-line"}`;
}

function Field(props: { label: string; error: string | null; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-medium">{props.label}</span>
      {props.children}
      {props.error && <span role="alert" className="text-[12px] text-danger">{props.error}</span>}
    </label>
  );
}
