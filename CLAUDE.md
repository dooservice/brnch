# brnch

Tauri + Rust (edition 2024) desktop app that runs AI coding agents in parallel, each in a gitd
workspace. Read `CONTRIBUTING.md` before changing code: its **Code rules** are fixed and apply
to every change.

- Run everything through the Makefile (Docker); nothing is installed on the host.
- Add dependencies with `make add PACKAGE=<crate> DEPENDENCY=<name>` (`cargo add`), never by
  editing versions by hand.
- Layout: `crates/brnch-core` (rules, no gitd, no UI), `crates/brnch-gitd` (gitd adapter),
  `crates/brnch-process` (runs an agent as a process), `crates/brnch-agents` (agent output -> common events), `crates/brnch-events` (bounded replay
  log), `crates/brnch-store` (SQLite projects/views), `crates/brnch-sandbox` (fail-closed
  confinement), `apps/desktop` (React + Tailwind + Radix interface, pnpm; `src-tauri` is the thin Tauri shell, checked with
  `make desktop-check`; the interface with `make frontend-test` / `make frontend-build`; add libraries with `make frontend-add PACKAGE=<name>` (pnpm add), never npm).
- Before finishing a change: `make format && make lint && make test`. Tests that need a real
  gitd are `#[ignore]` and run with `make integration`.
- No identifier starts with an underscore, not even unused parameters or test fakes.

## Running agents from the window
- `BRNCH_WORKSPACES_ROOT`: where workspaces are created (default: `workspaces/` in the app data folder). It must be inside one of gitd's roots.
- `BRNCH_SANDBOX_READ_ONLY`: extra folders the confined agent may read (gitd's pool, where the agent program lives), separated like `PATH`.
- gitd is connected on the first run, not at start-up; if it is not running the dialog shows the error.
- An agent never starts without a sandbox. Windows has none verified yet (`WindowsAccountBackend` refuses), so on Windows a run ends with a "no sandbox" failure until that backend is finished.

## Interface structure (copied from dooservice/app-dooservice)
`apps/desktop/src` follows the same modular layout as that project:
- `core/`: module registry, router registry and slots. A module is `modules/<name>/{api,components,views,types,lib,manifest.ts,module.ts,index.ts}`; its manifest declares routes, `depends` and what it contributes. Modules talk to each other only through their `index.ts`.
- `app/` (bootstrap, router, providers, live events), `components/` (shared primitives, snake_case files), `hooks/`, `lib/`.
- Modules: `projects`, `workspaces`, `review`, `runs`, `settings`, `onboarding` (+ `shell`, the window around every page).
- Data is TanStack Query over Tauri commands (`lib/tauri.ts`); the agents' live events go into the query cache (`app/live_events.tsx`). Dialogs open through the address (`hooks/use_dialog.ts`: `?dialog=...`). A project's last page is saved so entering it again restores it.
- Style: no semicolons, single quotes, `@/` alias. The rule "no identifier starts with an underscore" is enforced by ESLint (their registry uses `_private` fields; here they are plain `private`).

## i18n
Translations live INSIDE this repository (not a submodule): `apps/desktop/locales/<language>/<namespace>.json`, one file per module namespace, languages listed in `locales/languages.json` (today: `es`, `en`). Components use `useTranslation('<namespace>')`; keys are type-checked against the English catalog (`src/i18n.d.ts`) and `pnpm check:i18n` fails when a key is missing in any language or a language has extra/missing keys. To add a language: add its folder with every namespace file and its entry in `languages.json`.
`make frontend-check` runs tsc, eslint (0 warnings), the i18n check, the tests and the build.
