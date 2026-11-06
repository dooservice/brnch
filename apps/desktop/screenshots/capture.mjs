// Renders the built interface in headless Chromium with the Rust side faked, and saves one
// picture per screen. Run with `make screenshots`.
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
const workspace = (identifier, branchName, title, status, runIdentifier, cost) => ({
  identifier, directory: `D:\\brnch\\${branchName}`, branchName, title, agentLabel: "Claude Code", runIdentifier, status,
  startedAtMilliseconds: Date.now() - 6 * 60_000, costInDollars: cost, durationInMilliseconds: cost === null ? null : 41_200,
});
const workspacesByProject = {
  p1: [
    workspace("w1", "agents/add-search", "Añadir búsqueda", "running", "r1", null),
    workspace("w2", "agents/add-search-2", "Añadir búsqueda", "done", "r1", 0.42),
    workspace("w3", "agents/add-search-3", "Añadir búsqueda", "failed", "r1", 0.55),
    workspace("w5", "agents/dark-mode", "Modo oscuro", "done", "r2", 0.31),
  ],
  p2: [workspace("w4", "agents/invoice-pdf", "Factura en PDF", "running", "r3", null)],
  p3: [],
};
const events = [
  { kind: "user_message", text: "Añade una búsqueda por nombre y categoría al catálogo, con pruebas." },
  { kind: "session_started", session_identifier: "s1", model_name: "claude-sonnet-5-5" },
  { kind: "assistant_text", text: "Voy a revisar cómo está montado el catálogo y dónde vive el estado de los filtros antes de tocar nada." },
  { kind: "tool_requested", tool_call_identifier: "t1", tool_name: "Read", input_summary: '{"file_path":"src/catalog/CatalogPage.tsx"}' },
  { kind: "tool_completed", tool_call_identifier: "t1", failed: false },
  { kind: "tool_requested", tool_call_identifier: "t2", tool_name: "Edit", input_summary: '{"file_path":"src/catalog/SearchBox.tsx"}' },
  { kind: "tool_completed", tool_call_identifier: "t2", failed: false },
  { kind: "tool_requested", tool_call_identifier: "t3", tool_name: "Bash", input_summary: '{"command":"npm test -- search"}' },
  { kind: "unparsed_output", raw_line: "npm warn config production Use --omit=dev instead." },
];
const diff = [
  "diff --git a/src/catalog/SearchBox.tsx b/src/catalog/SearchBox.tsx",
  "new file mode 100644",
  "@@ -0,0 +1,7 @@",
  '+import { useState } from "react";',
  '+import { useFilters } from "./useFilters";',
  "+",
  "+export function SearchBox() {",
  "+  const { query, setQuery } = useFilters();",
  "+  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;",
  "+}",
  "diff --git a/src/catalog/useFilters.ts b/src/catalog/useFilters.ts",
  "@@ -10,6 +10,7 @@ export function useFilters() {",
  "   const [category, setCategory] = useState(null);",
  "-  return { category, setCategory };",
  '+  const [query, setQuery] = useState("");',
  "+  return { category, setCategory, query, setQuery };",
  " }",
].join("\n");

function fakeBackend(data) {
  window.localStorage.setItem("brnch.onboarded", data.onboarded ? "1" : "");
  window.localStorage.setItem("brnch.language", data.language ?? "es");
  window.__TAURI_INTERNALS__ = {
    transformCallback: () => 1,
    invoke: async (command, args) => {
      switch (command) {
        case "list_projects": return data.projects;
        case "active_project_identifier": return data.active;
        case "list_workspaces": return data.workspacesByProject[args.projectIdentifier] ?? [];
        case "load_view": return null;
        case "list_workspace_events":
          return ["w1", "w2"].includes(args.workspaceIdentifier)
            ? data.events.map((event, index) => ({ workspaceIdentifier: args.workspaceIdentifier, sequence: index + 1, eventJson: JSON.stringify(event) }))
            : [];
        case "read_workspace_diff": return { unifiedDiff: data.diff, wasTruncated: false };
        case "find_project_conflicts":
          return [{ firstWorkspaceIdentifier: "w1", secondWorkspaceIdentifier: "w3", clashingPaths: ["src/Header.tsx", "src/theme/tokens.ts"] }];
        case "publish_workspaces":
          return args.workspaceIdentifiers.map((id) => ({ workspaceIdentifier: id, branchName: "agents/add-search-2", failure: null }));
        case "sandbox_status": return { available: true, mechanism: "bubblewrap", reason: null };
        case "detect_agents": return [{ kind: "claude_code", installed: true, version: "2.1.0 (Claude Code)" }];
        case "gitd_status": return { connected: true, message: null };
        case "plugin:event|listen": return 1;
        default: return null;
      }
    },
  };
}

const scenarios = [
  { file: "01-welcome", projects: [], active: null, onboarded: false },
  { file: "02-empty", projects: [], active: null, onboarded: true },
  { file: "03-project-open", active: "p1" },
  { file: "04-agent", active: "p1", act: async (page) => page.getByRole("link", { name: /add-search Claude Code/ }).click() },
  {
    file: "05-changes", active: "p1",
    act: async (page) => {
      await page.getByRole("link", { name: /add-search-2 Claude Code/ }).click();
      await page.getByRole("tab", { name: /Cambios/ }).click();
    },
  },
  { file: "06-compare", active: "p1", act: async (page) => page.getByRole("link", { name: /Corrida · Añadir búsqueda/ }).click() },
  { file: "07-palette", active: "p1", act: async (page) => page.keyboard.press("Control+k") },
  {
    file: "08-new-run", active: "p1",
    act: async (page) => {
      await page.getByRole("button", { name: "Nueva corrida" }).click();
      await page.getByLabel("Tarea").fill("Añade una búsqueda por nombre y categoría al catálogo, con pruebas.");
      await page.getByRole("button", { name: "Más copias" }).click();
    },
  },
  {
    file: "09-publish", active: "p1",
    act: async (page) => {
      await page.getByRole("link", { name: /Modo oscuro/ }).click();
      await page.getByRole("button", { name: "Publicar" }).click();
    },
  },
  {
    file: "10-add-project", active: "p1",
    act: async (page) => {
      await page.getByRole("button", { name: "Añadir proyecto" }).first().click();
      await page.getByLabel("Nombre").fill("docs-site");
      await page.getByLabel("URL del repositorio").fill("https://github.com/acme/docs-site");
    },
  },
  { file: "11-settings-agents", active: "p1", act: async (page) => { await page.getByRole("button", { name: "Ajustes" }).click(); await page.getByRole("link", { name: "Agentes" }).click(); } },
  { file: "12-settings-security", active: "p1", act: async (page) => { await page.getByRole("button", { name: "Ajustes" }).click(); await page.getByRole("link", { name: "Seguridad" }).click(); } },
  { file: "13-english", active: "p1", language: "en", act: async (page) => page.getByRole("link", { name: /add-search Claude Code/ }).click() },
];

const server = createServer(async (request, response) => {
  const path = request.url === "/" ? "/index.html" : request.url.split("?")[0];
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
  const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
  const data = { projects, workspacesByProject, events, diff, onboarded: true, ...scenario };
  await page.addInitScript(fakeBackend, data);
  await page.goto(`http://localhost:${port}/`);
  await page.waitForTimeout(700);
  await scenario.act?.(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUTPUT, `${scenario.file}.png`) });
  await page.close();
}
await browser.close();
server.close();
