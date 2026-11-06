import { FileText } from "lucide-react";
import { useEffect, useState } from "react";

import type { DiffSummary } from "../model/Review";
import { parseUnifiedDiff } from "../state/parseUnifiedDiff";
import type { DiffFile } from "../state/parseUnifiedDiff";
import type { ReviewState } from "../state/ReviewState";

type Loaded = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; diff: DiffSummary; files: DiffFile[] };

/** The Cambios tab: what the agent changed, file by file, as gitd reports it. */
export function DiffView({ review, workspaceIdentifier }: { readonly review: ReviewState; readonly workspaceIdentifier: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded({ status: "loading" });
    setSelectedPath(null);
    review
      .readDiff(workspaceIdentifier)
      .then((diff) => !cancelled && setLoaded({ status: "ready", diff, files: parseUnifiedDiff(diff.unifiedDiff) }))
      .catch((error: unknown) => !cancelled && setLoaded({ status: "failed", message: String(error) }));
    return () => {
      cancelled = true;
    };
  }, [review, workspaceIdentifier]);

  if (loaded.status === "loading") {
    return <p className="m-auto text-muted">Leyendo los cambios…</p>;
  }
  if (loaded.status === "failed") {
    return <p role="alert" className="m-auto max-w-120 text-center text-danger">{loaded.message}</p>;
  }
  if (loaded.files.length === 0) {
    return <p className="m-auto text-muted">El agente aún no ha cambiado ningún archivo.</p>;
  }
  const selected = loaded.files.find((file) => file.path === selectedPath) ?? loaded.files[0]!;

  return (
    <div className="-m-6 flex min-h-0 flex-1 text-ink">
      <ul aria-label="Archivos cambiados" className="w-72 shrink-0 overflow-y-auto border-r border-line bg-side py-2">
        {loaded.files.map((file) => (
          <li key={file.path}>
            <button
              type="button"
              aria-current={file.path === selected.path}
              onClick={() => setSelectedPath(file.path)}
              className={`mx-1.5 flex w-[calc(100%-12px)] items-center gap-2 rounded-md px-2.5 py-1.5 text-left hover:bg-hover ${file.path === selected.path ? "bg-hover" : ""}`}
            >
              <FileText size={14} className="shrink-0 text-muted" />
              <span className="flex-1 truncate font-mono text-[12px]">{file.path}</span>
              <span className="font-mono text-[11px]"><span className="text-ok">+{file.added}</span> <span className="text-danger">−{file.removed}</span></span>
            </button>
          </li>
        ))}
      </ul>
      <div className="min-w-0 flex-1 overflow-auto">
        {loaded.diff.wasTruncated && (
          <p role="status" className="border-b border-line bg-[#201b0e] px-4 py-2 text-[12.5px] text-warn">El diff era demasiado grande y se cortó. Falta parte de los cambios.</p>
        )}
        <div className="border-b border-line px-4 py-2.5 font-mono">{selected.path}</div>
        {selected.isBinary ? (
          <p className="p-4 text-muted">Archivo binario: no se muestra su contenido.</p>
        ) : (
          <div role="table" aria-label={`Diff de ${selected.path}`} className="py-1 font-mono text-[12.5px] leading-5.5">
            {selected.lines.map((line, index) => (
              <div key={index} role="row" className={`flex ${line.kind === "add" ? "bg-[#0e2219] text-[#8be0b2]" : line.kind === "remove" ? "bg-[#2a1416] text-[#f1a3a0]" : line.kind === "hunk" ? "bg-card text-muted" : ""}`}>
                <span className="w-11 shrink-0 pr-2.5 text-right text-[#5e5e69]">{line.oldNumber ?? ""}</span>
                <span className="w-11 shrink-0 pr-2.5 text-right text-[#5e5e69]">{line.newNumber ?? ""}</span>
                <span className="w-4 shrink-0 text-center">{line.kind === "add" ? "+" : line.kind === "remove" ? "−" : ""}</span>
                <span className="whitespace-pre">{line.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
