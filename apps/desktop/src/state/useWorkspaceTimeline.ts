import { useEffect, useReducer } from "react";

import type { WorkspaceTimelineState } from "./WorkspaceTimelineState";

/** Repaints the component whenever the timeline changes. */
export function useWorkspaceTimeline(timeline: WorkspaceTimelineState): WorkspaceTimelineState {
  const [, repaint] = useReducer((count: number) => count + 1, 0);
  useEffect(() => timeline.subscribe(repaint), [timeline]);
  return timeline;
}
