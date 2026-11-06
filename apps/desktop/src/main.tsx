import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TauriProjectBackend } from "./backend/TauriProjectBackend";
import { AppShell } from "./components/AppShell";
import "./index.css";
import { ProjectSwitcherState } from "./state/ProjectSwitcherState";

const state = new ProjectSwitcherState(new TauriProjectBackend());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppShell state={state} />
  </StrictMode>,
);
