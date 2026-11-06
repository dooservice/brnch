import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppShell } from "../src/components/AppShell";
import { ProjectSwitcherState } from "../src/state/ProjectSwitcherState";
import { InMemoryProjectBackend } from "./InMemoryProjectBackend";

async function shellWithProjects(...names: string[]) {
  const backend = new InMemoryProjectBackend();
  for (const name of names) {
    await backend.addProject(name, `https://example.com/${name}`);
  }
  const state = new ProjectSwitcherState(backend);
  render(<AppShell state={state} />);
  return state;
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

    expect(await screen.findByRole("button", { name: /agents\/x/, hidden: false })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /agents\/x/ })[0]!);
    expect(await screen.findByRole("heading", { name: "agents/x" })).toBeInTheDocument();
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
