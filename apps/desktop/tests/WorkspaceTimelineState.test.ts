import { describe, expect, it } from "vitest";

import type { RunNotice } from "../src/model/AgentEvent";
import { WorkspaceTimelineState } from "../src/state/WorkspaceTimelineState";
import { InMemoryProjectBackend } from "./InMemoryProjectBackend";

function notice(sequence: number, text: string): RunNotice {
  return {
    workspaceIdentifier: "w",
    sequence,
    eventJson: JSON.stringify({ kind: "assistant_text", text }),
  };
}

describe("WorkspaceTimelineState", () => {
  it("shows the history in order and adds live events after it", async () => {
    const backend = new InMemoryProjectBackend();
    backend.seedHistory("w", [notice(2, "second"), notice(1, "first")]);
    const timeline = new WorkspaceTimelineState(backend);
    await timeline.startListening();

    await timeline.loadHistory("w");
    backend.emitLive(notice(3, "third"));

    const texts = timeline.eventsOf("w").map((entry) => (entry.event.kind === "assistant_text" ? entry.event.text : ""));
    expect(texts).toEqual(["first", "second", "third"]);
  });

  it("keeps an event once when the history and the live feed both deliver it", async () => {
    const backend = new InMemoryProjectBackend();
    backend.seedHistory("w", [notice(1, "only")]);
    const timeline = new WorkspaceTimelineState(backend);
    await timeline.startListening();

    backend.emitLive(notice(1, "only"));
    await timeline.loadHistory("w");

    expect(timeline.eventsOf("w")).toHaveLength(1);
  });

  it("tells subscribers about live events until it stops listening", async () => {
    const backend = new InMemoryProjectBackend();
    const timeline = new WorkspaceTimelineState(backend);
    let announcements = 0;
    timeline.subscribe(() => (announcements += 1));
    await timeline.startListening();

    backend.emitLive(notice(1, "a"));
    timeline.stop();
    backend.emitLive(notice(2, "b"));

    expect(announcements).toBe(1);
  });
});
