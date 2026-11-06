import { useEffect, useReducer } from "react";

import type { ProjectSwitcherState } from "./ProjectSwitcherState";

/** Repaints the component whenever the state announces a change. */
export function useProjectSwitcher(state: ProjectSwitcherState): ProjectSwitcherState {
  const [, repaint] = useReducer((count: number) => count + 1, 0);
  useEffect(() => state.subscribe(repaint), [state]);
  return state;
}
