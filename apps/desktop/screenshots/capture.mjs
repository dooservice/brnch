// Renders the built interface in headless Chromium with the Rust side faked, and saves one
// picture per state. Run with `make screenshots`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { chromium } from "playwright-core";

const DIST = join(import.meta.dirname, "..", "dist");
const OUTPUT = import.meta.dirname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const projects = [
  { identifier: "p1", name: "web-store", repositoryUrl: "https://github.com/acme/web-store" },
  { identifier: "p2", name: "billing-api", repositoryUrl: "https://github.com/acme/billing-api" },
  { identifier: "p3", name: "mobile-app", repositoryUrl: "https://github.com/acme/mobile-app" },
];
const workspaces = [
  { identifier: "w1", directory: "/work/web-store/fix-login", branchName: "agents/fix-login" },
  { identifier: "w2", directory: "/work/web-store/add-search", branchName: "agents/add-search" },
  { identifier: "w3", directory: "/work/web-store/dark-mode", branchName: "agents/dark-mode" },
];

const scenarios = [
  { file: "01-empty", projects: [], active: null },
  { file: "02-projects-none-open", projects, active: null },
  { file: "03-project-with-workspaces", projects, active: "p1", workspaces },
  { file: "04-adding-a-project", projects, active: "p1", workspaces, fill: true },
];

function fakeBackend(scenario) {
  const data = { ...scenario, workspaces: scenario.workspaces ?? [] };
  window.__TAURI_INTERNALS__ = {
    invoke: async (command) => {
      switch (command) {
        case "list_projects": return data.projects;
        case "active_project_identifier": return data.active;
        case "list_workspaces": return data.workspaces;
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
  await page.addInitScript(fakeBackend, scenario);
  await page.goto(`http://localhost:${port}/`);
  await page.waitForTimeout(300);
  if (scenario.fill) {
    await page.locator("input[name=name]").fill("docs-site");
    await page.locator("input[name=repositoryUrl]").fill("https://github.com/acme/docs-site");
  }
  await page.screenshot({ path: join(OUTPUT, `${scenario.file}.png`) });
  await page.close();
}
await browser.close();
server.close();
