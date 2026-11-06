import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppShell } from "../src/components/AppShell";
import { ProjectSwitcherState } from "../src/state/ProjectSwitcherState";
import { ReviewState } from "../src/state/ReviewState";
import { WorkspaceTimelineState } from "../src/state/WorkspaceTimelineState";
import { InMemoryProjectBackend } from "./InMemoryProjectBackend";

async function shellWithProjects(...names: string[]) {
  const backend = new InMemoryProjectBackend();
  for (const name of names) {
    await backend.addProject(name, `https://example.com/${name}`);
  }
  const state = new ProjectSwitcherState(backend);
  const timeline = new WorkspaceTimelineState(backend);
  render(<AppShell state={state} timeline={timeline} review={new ReviewState(backend)} />);
  return { state, backend };
}

describe("AppShell", () => {
  it("lists every project in the sidebar once the state has loaded", async () => {
    await shellWithProjects("web-store", "billing-api");

    expect(await screen.findByRole("button", { name: /web-store/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /billing-api/ })).toBeInTheDocument();
  });

  it("invites to add a project when there are none", async () => {
    await shellWithProjects();

    expect(await screen.findByText(/Añade un proyecto para empezar/)).toBeInTheDocument();
  });

  it("opens a project's workspace when it is chosen in the sidebar", async () => {
    const user = userEvent.setup();
    await shellWithProjects("web-store", "billing-api");

    await user.click(await screen.findByRole("button", { name: /billing-api/ }));

    expect(await screen.findByRole("button", { name: /agents\/project-2/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /agents\/project-2/ }));
    expect(await screen.findByRole("heading", { name: "agents/project-2" })).toBeInTheDocument();
  });

  it("adds a project from the dialog and shows it", async () => {
    const user = userEvent.setup();
    await shellWithProjects();
    await screen.findByText(/Añade un proyecto para empezar/);

    await user.click(screen.getByRole("button", { name: "Añadir proyecto" }));
    await user.type(screen.getByLabelText("Nombre"), "docs-site");
    await user.type(screen.getByLabelText("URL del repositorio"), "https://github.com/acme/docs-site");
    await user.click(screen.getByRole("button", { name: "Añadir proyecto", hidden: false, description: "" }).closest("form")!.querySelector("button[type=submit]")!);

    await waitFor(() => expect(screen.getByRole("button", { name: /docs-site/ })).toBeInTheDocument());
  });

  it("refuses an address that is not a repository URL and says why", async () => {
    const user = userEvent.setup();
    await shellWithProjects();
    await user.click(await screen.findByRole("button", { name: "Añadir proyecto" }));
    await user.type(screen.getByLabelText("Nombre"), "docs-site");
    await user.type(screen.getByLabelText("URL del repositorio"), "not a url");

    await user.click(document.querySelector("button[type=submit]")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(/URL https, ssh/);
  });

  it("opens the palette with Ctrl K and jumps to a project", async () => {
    const user = userEvent.setup();
    await shellWithProjects("web-store", "billing-api");
    await screen.findByRole("button", { name: /web-store/ });

    await user.keyboard("{Control>}k{/Control}");
    await user.click(await screen.findByRole("option", { name: /^billing-api\s*\d+ workspaces$/ }));

    await waitFor(() => expect(screen.getByRole("button", { name: /billing-api/, expanded: true })).toBeInTheDocument());
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});

describe("AppShell runs", () => {
  it("starts a run from the dialog with a name taken from the task and the chosen copies", async () => {
    const user = userEvent.setup();
    const { backend } = await shellWithProjects("web-store");
    await user.click(await screen.findByRole("button", { name: /web-store/ }));
    await user.click(await screen.findByRole("button", { name: "Nueva corrida" }));
    await user.type(screen.getByLabelText("Tarea"), "Añade una búsqueda por nombre al catálogo con pruebas");
    await user.click(screen.getByRole("button", { name: "Más copias" }));

    await user.click(screen.getByRole("button", { name: "Lanzar 2 agentes" }));

    await waitFor(() => expect(backend.startedRuns).toHaveLength(1));
    expect(backend.startedRuns[0]).toMatchObject({
      projectIdentifier: "project-1",
      runLabel: "Añade una búsqueda por nombre al",
      agentKind: "claude_code",
      copies: 2,
    });
  });

  it("asks for the task before starting anything", async () => {
    const user = userEvent.setup();
    const { backend } = await shellWithProjects("web-store");
    await user.click(await screen.findByRole("button", { name: /web-store/ }));
    await user.click(await screen.findByRole("button", { name: "Nueva corrida" }));

    await user.click(screen.getByRole("button", { name: "Lanzar 1 agente" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Describe la tarea");
    expect(backend.startedRuns).toHaveLength(0);
  });

  it("shows the agent's history and its live events in the Agente tab", async () => {
    const user = userEvent.setup();
    const { backend } = await shellWithProjects("web-store");
    backend.seedHistory("workspace-of-project-1", [
      { workspaceIdentifier: "workspace-of-project-1", sequence: 1, eventJson: JSON.stringify({ kind: "assistant_text", text: "Reviso el catálogo" }) },
    ]);
    await user.click(await screen.findByRole("button", { name: /web-store/ }));
    await user.click(await screen.findByRole("button", { name: /agents\/project-1/ }));

    expect(await screen.findByText("Reviso el catálogo")).toBeInTheDocument();
    backend.emitLive({
      workspaceIdentifier: "workspace-of-project-1",
      sequence: 2,
      eventJson: JSON.stringify({ kind: "run_finished", succeeded: true, summary: "Hecho", cost_in_dollars: 0.12, duration_in_milliseconds: 3000 }),
    });

    expect(await screen.findByText("Hecho")).toBeInTheDocument();
    expect(screen.getByText("Terminó")).toBeInTheDocument();
  });
});

describe("AppShell sidebar", () => {
  it("shows a project's workspaces when it is entered and folds them when the open project is clicked again", async () => {
    const user = userEvent.setup();
    await shellWithProjects("web-store", "billing-api");

    await user.click(await screen.findByRole("button", { name: /web-store/ }));
    expect(await screen.findByRole("button", { name: /agents\/project-1/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /web-store/ }));
    expect(screen.queryByRole("button", { name: /agents\/project-1/ })).not.toBeInTheDocument();
  });
});

describe("AppShell review", () => {
  async function openSelectedWorkspace(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
    const shell = await shellWithProjects(...names);
    await user.click(await screen.findByRole("button", { name: new RegExp(names[0]!) }));
    await user.click(await screen.findByRole("button", { name: /agents\/project-1/ }));
    return shell;
  }

  it("lists the changed files in the Cambios tab and shows the lines of the chosen one", async () => {
    const user = userEvent.setup();
    const { backend } = await shellWithProjects("web-store");
    backend.diffs.set("workspace-of-project-1", {
      wasTruncated: false,
      unifiedDiff: ["diff --git a/src/a.ts b/src/a.ts", "@@ -1,1 +1,2 @@", " keep", "+brand new line"].join("\n"),
    });
    await user.click(await screen.findByRole("button", { name: /web-store/ }));
    await user.click(await screen.findByRole("button", { name: /agents\/project-1/ }));

    await user.click(screen.getByRole("tab", { name: /Cambios/ }));

    expect(await screen.findByRole("button", { name: /src\/a\.ts/ })).toBeInTheDocument();
    expect(await screen.findByText("brand new line")).toBeInTheDocument();
  });

  it("says so when the agent has not changed anything", async () => {
    const user = userEvent.setup();
    await openSelectedWorkspace(user, "web-store");

    await user.click(screen.getByRole("tab", { name: /Cambios/ }));

    expect(await screen.findByText(/aún no ha cambiado ningún archivo/)).toBeInTheDocument();
  });

  it("publishes the selected workspace and reports a refusal with its reason", async () => {
    const user = userEvent.setup();
    const { backend } = await openSelectedWorkspace(user, "web-store");
    backend.publishFailure = "La política de gitd rechazó la rama";

    await user.click(screen.getByRole("button", { name: "Publicar" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Publicar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La política de gitd rechazó la rama");
    expect(backend.publishedBatches).toEqual([["workspace-of-project-1"]]);
  });

  it("offers the conflict check only when there are at least two workspaces", async () => {
    const user = userEvent.setup();
    await openSelectedWorkspace(user, "web-store");

    expect(screen.queryByRole("button", { name: "Conflictos" })).not.toBeInTheDocument();
  });
});
