// Renders the built interface in headless Chromium with the Rust side faked, and saves one
// picture per state. Run with `make screenshots`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright-core";

const DIST = join(import.meta.dirname, "..", "dist");
const OUTPUT = import.meta.dirname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2" };

const projects = [
  { identifier: "p1", name: "web-store", repositoryUrl: "https://github.com/acme/web-store" },
  { identifier: "p2", name: "billing-api", repositoryUrl: "https://github.com/acme/billing-api" },
  { identifier: "p3", name: "mobile-app", repositoryUrl: "https://github.com/acme/mobile-app" },
];
const workspacesByProject = {
  p1: [
    { identifier: "w1", directory: "D:\\brnch\\web-store\\add-search", branchName: "agents/add-search" },
    { identifier: "w2", directory: "D:\\brnch\\web-store\\fix-login", branchName: "agents/fix-login" },
    { identifier: "w3", directory: "D:\\brnch\\web-store\\dark-mode", branchName: "agents/dark-mode" },
  ],
  p2: [{ identifier: "w4", directory: "D:\\brnch\\billing-api\\invoice-pdf", branchName: "agents/invoice-pdf" }],
  p3: [],
};

const sampleEvents = [
  { kind: "session_started", session_identifier: "s1", model_name: "claude-sonnet-5-5" },
  { kind: "assistant_text", text: "Voy a revisar cómo está montado el catálogo y dónde vive el estado de los filtros antes de tocar nada." },
  { kind: "tool_requested", tool_call_identifier: "t1", tool_name: "Read", input_summary: '{"file_path":"src/catalog/CatalogPage.tsx"}' },
  { kind: "tool_completed", tool_call_identifier: "t1", failed: false },
  { kind: "tool_requested", tool_call_identifier: "t2", tool_name: "Edit", input_summary: '{"file_path":"src/catalog/SearchBox.tsx"}' },
  { kind: "tool_completed", tool_call_identifier: "t2", failed: false },
  { kind: "tool_requested", tool_call_identifier: "t3", tool_name: "Bash", input_summary: '{"command":"npm test -- search"}' },
  { kind: "unparsed_output", raw_line: "npm warn config production Use --omit=dev instead." },
  { kind: "tool_completed", tool_call_identifier: "t3", failed: true },
  { kind: "run_finished", succeeded: false, summary: "Las pruebas de búsqueda fallan: falta el filtro por categoría.", cost_in_dollars: 0.31, duration_in_milliseconds: 41200 },
];

const sampleDiff = [
  "diff --git a/src/catalog/SearchBox.tsx b/src/catalog/SearchBox.tsx",
  "new file mode 100644",
  "@@ -0,0 +1,9 @@",
  '+import { useState } from "react";',
  '+import { useFilters } from "./useFilters";',
  "+",
  "+export function SearchBox() {",
  "+  const { query, setQuery } = useFilters();",
  "+  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;",
  "+}",
  "diff --git a/src/catalog/useFilters.ts b/src/catalog/useFilters.ts",
  "@@ -10,6 +10,9 @@ export function useFilters() {",
  "   const [category, setCategory] = useState(null);",
  "-  return { category, setCategory };",
  "+  const [query, setQuery] = useState(\"\");",
  "+  return { category, setCategory, query, setQuery };",
  " }",
].join("\n");

const scenarios = [
  { file: "01-empty", projects: [], active: null },
  { file: "02-project-open", projects, active: "p1" },
  {
    file: "03-workspace-selected",
    projects,
    active: "p1",
    act: async (page) => page.getByRole("button", { name: /agents\/add-search/ }).click(),
  },
  {
    file: "06-agent-timeline",
    projects,
    active: "p1",
    act: async (page) => page.getByRole("button", { name: /agents\/add-search/ }).click(),
  },
  {
    file: "07-new-run",
    projects,
    active: "p1",
    act: async (page) => {
      await page.getByRole("button", { name: "Nueva corrida" }).click();
      await page.getByLabel("Tarea").fill("Añade una búsqueda por nombre y categoría al catálogo, con pruebas.");
      await page.getByRole("button", { name: "Más copias" }).click();
    },
  },
  {
    file: "08-changes",
    projects,
    active: "p1",
    act: async (page) => {
      await page.getByRole("button", { name: /agents\/add-search/ }).click();
      await page.getByRole("tab", { name: /Cambios/ }).click();
    },
  },
  {
    file: "09-conflicts",
    projects,
    active: "p1",
    act: async (page) => {
      await page.getByRole("button", { name: "Conflictos" }).click();
    },
  },
  {
    file: "10-publish",
    projects,
    active: "p1",
    act: async (page) => {
      await page.getByRole("button", { name: /agents\/add-search/ }).click();
      await page.getByRole("button", { name: "Publicar" }).click();
    },
  },
  {
    file: "04-command-palette",
    projects,
    active: "p1",
    act: async (page) => page.keyboard.press("Control+k"),
  },
  {
    file: "05-add-project",
    projects,
    active: "p1",
    act: async (page) => {
      await page.getByRole("button", { name: "Añadir proyecto" }).click();
      await page.getByLabel("Nombre").fill("docs-site");
      await page.getByLabel("URL del repositorio").fill("https://github.com/acme/docs-site");
    },
  },
];

function fakeBackend(scenario) {
  window.__TAURI_INTERNALS__ = {
    transformCallback: () => 1,
    invoke: async (command, args) => {
      switch (command) {
        case "list_projects": return scenario.projects;
        case "active_project_identifier": return scenario.active;
        case "list_workspaces": return scenario.workspacesByProject[args.projectIdentifier] ?? [];
        case "list_workspace_events":
          return args.workspaceIdentifier === "w1"
            ? scenario.sampleEvents.map((event, index) => ({ workspaceIdentifier: "w1", sequence: index + 1, eventJson: JSON.stringify(event) }))
            : [];
        case "read_workspace_diff": return { unifiedDiff: scenario.sampleDiff, wasTruncated: false };
        case "find_project_conflicts":
          return [{ firstWorkspaceIdentifier: "w1", secondWorkspaceIdentifier: "w3", clashingPaths: ["src/Header.tsx", "src/theme/tokens.ts"] }];
        case "publish_workspaces":
          return args.workspaceIdentifiers.map((id) => ({ workspaceIdentifier: id, branchName: "agents/add-search", failure: null }));
        case "plugin:event|listen": return 1;
        default: return null;
      }
    },
  };
}

const server = createServer(async (request, response) => {
  const path = request.url === "/" ? "/index.html" : request.url;
  try {
    const body = await readFile(join(DIST, path));
    response.setHeader("content-type", TYPES[extname(path)] ?? "application/octet-stream");
    response.end(body);
  } catch {
    response.statusCode = 404;
    response.end();
  }
}).listen(0);

const { port } = server.address();
const browser = await chromium.launch();
for (const scenario of scenarios) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(fakeBackend, { ...scenario, workspacesByProject, sampleEvents, sampleDiff });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForTimeout(400);
  await scenario.act?.(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUTPUT, `${scenario.file}.png`) });
  await page.close();
}
await browser.close();
server.close();
