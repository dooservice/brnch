import { describe, expect, it } from "vitest";

import type { AgentEvent } from "../src/model/AgentEvent";
import { buildTimelineItems } from "../src/state/timelineItems";

const entries = (...events: AgentEvent[]) => events.map((event, index) => ({ sequence: index + 1, event }));

describe("buildTimelineItems", () => {
  it("joins a tool request with its result into a single row", () => {
    const items = buildTimelineItems(
      entries(
        { kind: "tool_requested", tool_call_identifier: "t1", tool_name: "Edit", input_summary: "{}" },
        { kind: "tool_completed", tool_call_identifier: "t1", failed: false },
      ),
    );

    expect(items).toEqual([{ type: "tool", key: 1, name: "Edit", summary: "{}", status: "done" }]);
  });

  it("leaves a tool as running until its result arrives, and marks a failure", () => {
    const running = buildTimelineItems(
      entries({ kind: "tool_requested", tool_call_identifier: "t", tool_name: "Bash", input_summary: "ls" }),
    );
    const failed = buildTimelineItems(
      entries(
        { kind: "tool_requested", tool_call_identifier: "t", tool_name: "Bash", input_summary: "ls" },
        { kind: "tool_completed", tool_call_identifier: "t", failed: true },
      ),
    );

    expect(running[0]).toMatchObject({ status: "running" });
    expect(failed[0]).toMatchObject({ status: "failed" });
  });

  it("shows what it does not understand instead of hiding it, and the final result in seconds", () => {
    const items = buildTimelineItems(
      entries(
        { kind: "unparsed_output", raw_line: "Error: not logged in" },
        { kind: "run_finished", succeeded: false, summary: "boom", cost_in_dollars: 0.5, duration_in_milliseconds: 4200 },
      ),
    );

    expect(items).toEqual([
      { type: "unparsed", key: 1, rawLine: "Error: not logged in" },
      { type: "finished", key: 2, succeeded: false, summary: "boom", cost: 0.5, seconds: 4.2 },
    ]);
  });
});
