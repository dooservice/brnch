import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TauriProjectBackend } from "./backend/TauriProjectBackend";
import { AppShell } from "./components/AppShell";
import "./index.css";
import { ProjectSwitcherState } from "./state/ProjectSwitcherState";
import { ReviewState } from "./state/ReviewState";
import { WorkspaceTimelineState } from "./state/WorkspaceTimelineState";

const backend = new TauriProjectBackend();
const state = new ProjectSwitcherState(backend);
const timeline = new WorkspaceTimelineState(backend);
const review = new ReviewState(backend);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell state={state} timeline={timeline} review={review} />
  </StrictMode>,
);
