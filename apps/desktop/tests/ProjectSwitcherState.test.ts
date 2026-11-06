import { describe, expect, it } from "vitest";

import { ProjectSwitcherState } from "../src/state/ProjectSwitcherState";
import { InMemoryProjectBackend } from "./InMemoryProjectBackend";

describe("ProjectSwitcherState", () => {
  it("brings each project back with the layout it was left with", async () => {
    const state = new ProjectSwitcherState(new InMemoryProjectBackend());
    await state.load();
    await state.addProject("first", "https://example.com/a");
    state.updateActiveLayout('{"tabs":["a.rs"]}');
    await state.addProject("second", "https://example.com/b");
    expect(state.activeLayoutJson).toBeNull();

    await state.switchTo("project-1");

    expect(state.activeProjectIdentifier).toBe("project-1");
    expect(state.activeLayoutJson).toBe('{"tabs":["a.rs"]}');
    expect(state.workspaces[0]?.directory).toBe("/work/project-1");
  });

  it("tells subscribers once per change and stops after unsubscribing", async () => {
    const state = new ProjectSwitcherState(new InMemoryProjectBackend());
    let announcements = 0;
    const stop = state.subscribe(() => (announcements += 1));

    await state.addProject("only", "https://example.com/a");
    stop();
    await state.addProject("other", "https://example.com/b");

    expect(announcements).toBe(1);
  });

  it("shows no workspaces after the active project is removed", async () => {
    const state = new ProjectSwitcherState(new InMemoryProjectBackend());
    await state.addProject("only", "https://example.com/a");

    await state.removeProject("project-1");

    expect(state.activeProjectIdentifier).toBeNull();
    expect(state.workspaces).toEqual([]);
    expect(state.projects).toEqual([]);
  });
});
