import { Bot, Check, CircleAlert, CircleCheck, CircleX, Info, Loader2, Terminal, X } from "lucide-react";

import { buildTimelineItems } from "../state/timelineItems";
import type { TimelineItem } from "../state/timelineItems";
import type { TimelineEntry } from "../state/WorkspaceTimelineState";

/** What the agent of a workspace has done so far, oldest first. */
export function AgentTimeline({ entries }: { readonly entries: readonly TimelineEntry[] }) {
  const items = buildTimelineItems(entries);
  if (items.length === 0) {
    return <p className="text-center text-muted">El agente aún no ha dicho nada. Su actividad aparecerá aquí.</p>;
  }
  return (
    <ol aria-label="Actividad del agente" className="mx-auto flex w-full max-w-175 flex-col gap-3">
      {items.map((item) => (
        <li key={item.key}>
          <Row item={item} />
        </li>
      ))}
    </ol>
  );
}

function Row({ item }: { readonly item: TimelineItem }) {
  switch (item.type) {
    case "session":
      return <p className="text-[12px] text-muted">Sesión iniciada · modelo {item.modelName}</p>;
    case "message":
      return (
        <div className="flex gap-3">
          <span className="flex size-6.5 shrink-0 items-center justify-center rounded-md border border-line"><Bot size={14} /></span>
          <p className="pt-0.5 leading-relaxed whitespace-pre-wrap">{item.text}</p>
        </div>
      );
    case "tool":
      return (
        <div className="ml-9.5 flex items-center gap-2.5 rounded-md border border-line bg-card px-2.5 py-1.5 text-[12.5px]">
          <Terminal size={14} className="text-muted" />
          <span className="text-muted">{item.name}</span>
          <span className="flex-1 truncate font-mono">{item.summary}</span>
          {item.status === "running" && <Loader2 size={14} role="status" aria-label="En curso" className="animate-spin text-warn" />}
          {item.status === "done" && <Check size={14} aria-label="Terminó bien" className="text-ok" />}
          {item.status === "failed" && <X size={14} aria-label="Falló" className="text-danger" />}
        </div>
      );
    case "unparsed":
      return (
        <div className="ml-9.5 flex items-start gap-2.5 rounded-md border border-dashed border-line px-2.5 py-1.5 text-[12.5px]">
          <Info size={14} className="mt-0.5 shrink-0 text-muted" />
          <span className="font-mono break-all text-muted">{item.rawLine}</span>
        </div>
      );
    case "finished":
      return (
        <div className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 ${item.succeeded ? "border-[#1d4a33] bg-[#0e1c15]" : "border-[#5a2326] bg-[#1c0f10]"}`}>
          {item.succeeded ? <CircleCheck size={16} className="mt-0.5 text-ok" /> : <CircleX size={16} className="mt-0.5 text-danger" />}
          <div className="flex-1">
            <p className="font-medium">{item.succeeded ? "Terminó" : "No terminó"}</p>
            {item.summary !== "" && <p className="mt-0.5 whitespace-pre-wrap text-muted">{item.summary}</p>}
            <p className="mt-1 font-mono text-[11.5px] text-muted">
              {item.seconds !== null && `${item.seconds.toFixed(1)} s`}
              {item.seconds !== null && item.cost !== null && " · "}
              {item.cost !== null && `${item.cost.toFixed(2)} $`}
            </p>
          </div>
          {!item.succeeded && <CircleAlert size={14} className="mt-0.5 text-danger" />}
        </div>
      );
  }
}
