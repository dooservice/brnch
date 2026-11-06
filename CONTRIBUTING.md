# Contributing to brnch

brnch orchestrates AI coding agents, each in its own copy-on-write workspace made by
[gitd](https://github.com/dooservice/gitd). Nothing is installed on your machine: everything
runs in Docker through the Makefile.

## Commands

| Command | What it does |
|---|---|
| `make images` | Build the Docker image |
| `make test` | Run every test |
| `make lint` | Check formatting and clippy (`-D warnings`) |
| `make format` | Format the Rust code |
| `make add PACKAGE=brnch-core DEPENDENCY=thiserror` | Add a dependency with `cargo add` |

## Code rules

- Rust edition 2024. Object-oriented: structs and traits with `impl`; no loose or scattered
  variables or functions.
- Single responsibility at every level: function, method, struct and file. Small files, one
  concept each, named after the concept (`branch_namer.rs`).
- Descriptive, professional names. No one-to-three-letter identifiers and no cryptic
  abbreviations.
- No identifier starts with an underscore.
- Constants only where needed, and in their one home: `BrnchSettings` (core). Never
  scattered.
- The simplest correct code: no dead code, no needless indirection. Comments say why, in one
  short line.
- One error type per crate (`BrnchError`, with `thiserror`). Workspace lints forbid `unsafe`
  and run clippy pedantic.
- Dependencies are added with `cargo add` (the latest version), never typed by hand.
- Business rules live in `brnch-core`, which knows neither the interface nor gitd. Adapters
  (`brnch-gitd`) implement the core's traits; the interface only draws what the core decides.
- Code and comments in English. Visible text comes from locale files, never joined strings.
- Every rule comes with a test that hardcodes its expected values.
- Interface: TypeScript with React; one component per file, named after what it shows.

## Commits

One logical change per commit, with a message that says what changed and why. Keep
`make test` and `make lint` green.
