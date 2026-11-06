# Notice

`seatbelt_base_policy.sbpl`, `seatbelt_read_only_platform_defaults.sbpl` and
`seatbelt_network_policy.sbpl` are copied unchanged from
[openai/codex](https://github.com/openai/codex) (`codex-rs/sandboxing/src/`), which is licensed
under the Apache License 2.0. The probe removes the `com.apple.SecurityServer` line from the
network policy at run time, in memory, so the Keychain service stays unreachable.
