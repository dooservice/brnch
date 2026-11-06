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
    invoke: async (command, args) => {
      switch (command) {
        case "list_projects": return scenario.projects;
        case "active_project_identifier": return scenario.active;
        case "list_workspaces": return scenario.workspacesByProject[args.projectIdentifier] ?? [];
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
  await page.addInitScript(fakeBackend, { ...scenario, workspacesByProject });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForTimeout(400);
  await scenario.act?.(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUTPUT, `${scenario.file}.png`) });
  await page.close();
}
await browser.close();
server.close();
