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
