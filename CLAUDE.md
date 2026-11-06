# brnch

Tauri + Rust (edition 2024) desktop app that runs AI coding agents in parallel, each in a gitd
workspace. Read `CONTRIBUTING.md` before changing code: its **Code rules** are fixed and apply
to every change.

- Run everything through the Makefile (Docker); nothing is installed on the host.
- Add dependencies with `make add PACKAGE=<crate> DEPENDENCY=<name>` (`cargo add`), never by
  editing versions by hand.
- Layout: `crates/brnch-core` (rules, no gitd, no UI), `crates/brnch-gitd` (gitd adapter),
  `crates/brnch-process` (runs an agent as a process), `apps/desktop` (Tauri shell + Lit
  interface, not created yet).
- Before finishing a change: `make format && make lint && make test`. Tests that need a real
  gitd are `#[ignore]` and run with `make integration`.
- No identifier starts with an underscore, not even unused parameters or test fakes.
