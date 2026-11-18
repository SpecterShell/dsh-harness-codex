# Agent notes

- DSH tool restrictions mask inherited tools, while registrations in their own scope remain exempt.
- A complete persona replaces assembled prompt sections, while instruction and memory injectors may operate separately.
- A yielded process identifier proves a process is running, while a timeout or idle terminal result proves no exit status.
- Native DSH patch application can partially apply after preflight succeeds, so preserve its failure report.
- Codex model metadata can select code-mode tools even when the corresponding general feature default is off.
- The upstream memory feature is off by default even though its nested generate/use options default to true.
- Native compatibility includes prereleases and reads top-level engines.dsh, while legacy dsh.engines declarations are ignored.
- Loader fixtures must declare injected services before creating scopes, or registrations can disappear after initialization.
- pnpm 11's global root can omit the active hashed installation slot, so resolve the native anchor from the actual installation.
