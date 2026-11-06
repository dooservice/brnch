# brnch

Runs AI coding agents (Claude Code today) side by side, each in its own isolated copy-on-write
workspace made by [gitd](https://github.com/dooservice/gitd). Agents never hold your git token:
gitd publishes for them. Desktop app: Tauri + Rust + React.

## First run

1. **gitd.** Install and start it, and give it your git credential (see its README). brnch reaches
   it through `GITD_URL`, then `GITD_SOCKET`, then gitd's default socket. The first-run wizard and
   the status bar say whether gitd really answers.
2. **An agent.** Install Claude Code (`claude` on the `PATH`) and sign in.
3. **Isolation.** Agents never start without it.
   - Linux: install `bubblewrap` (`bwrap`).
   - Windows: Settings › Security › *Prepare* creates a local account (`brnchagent`) agents run
     under; Windows asks for administrator permission once. That account cannot see your Claude
     login, so give it an API key in the same page (kept protected for you with DPAPI).
   - macOS: no verified isolation yet; agents do not start.
4. **A project.** Add a repository by URL, or a local folder that has an `origin` (gitd refuses
   paths with no remote). Then start a run.

Settings › Security › *Check now* measures, with a real confined process, whether your home
folder is hidden from an agent and whether its workspace is writable.

## Windows installer

Every CI run on `main` uploads the `brnch-windows-installer` artifact (NSIS `.exe`) under
GitHub › Actions.

## Environment variables

`GITD_URL`, `GITD_SOCKET`, `BRNCH_WORKSPACES_ROOT` (where workspaces go),
`BRNCH_SANDBOX_READ_ONLY` (extra read-only folders for agents).

## Developing

Nothing is installed on the host; everything runs in Docker. See `CLAUDE.md` and `CONTRIBUTING.md`.
`make check` (Rust), `make frontend-check`, `make desktop-check`, `make window-smoke`,
`make screenshots`.

## What is verified, and what is not

Measured in CI on Linux and on a real Windows runner: the Windows dedicated account hides
credentials, runs the agent with its API key, returns its output and exit code; a tokenless agent
publishes through gitd. Not yet verified: a real Claude Code run end to end, UAC on a real
desktop, macOS isolation, agents other than Claude Code.
