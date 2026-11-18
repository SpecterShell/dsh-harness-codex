# Contributing

Bug reports and pull requests are welcome. For anything larger than a small fix, please open an issue first so the approach can be agreed on.

## Setup

The project requires Node.js 24.9 or newer, pnpm, and DeepSeek Harness 0.2.2-rc.3:

```sh
npm install -g @deepseek-ai/dsh@0.2.2-rc.3
pnpm install
pnpm build
```

## Tests

```sh
pnpm typecheck
pnpm test          # plugin tests, run against the installed DSH
pnpm test:proofs   # lower-level checks of the DSH APIs the plugins use
```

The tests locate DSH through the `dsh` command. Set `DSH_NATIVE_ANCHOR` to the path of DSH's `package.json` to use another installation. The tests start real processes in temporary directories and never call a model.

## Trying a local build

A separate DSH home should be used so that local settings, sessions and `AGENTS.md` files do not affect the result:

```sh
export DSH_HOME=~/.dsh-dev DSH_AGENTS_HOME=~/.dsh-dev/agents
dsh --profile dev --from-default-profile web --dump-config > /dev/null
dsh plugin --profile dev add link:$PWD
dsh --profile dev --port 13181
```

Sign in to a model provider in the web UI, then run `pnpm build` and restart DSH after each change.

## Evaluation

[eval/README.md](eval/README.md) describes the benchmark suites and the procedure for running them. When a change could affect the agent's behavior, at least the tasks it touches should be run on both presets.

## Codex prompts

The files in `prompts/codex/` are generated from a Codex checkout. To update them, check out the desired Codex commit and run:

```sh
node scripts/extract-codex-prompts.ts /path/to/codex
```

Then update the commit in `NOTICE` and in [docs/differences.md](docs/differences.md).

## Style

Write TypeScript that Node can run with type stripping, so no enums or namespaces. Add a short comment wherever the reason for the code is not obvious. Keep commits focused, and write the subject line in the imperative ("Add …", "Fix …").

## Releases

1. Move the `Unreleased` entries in `CHANGELOG.md` under a new version heading.
2. Bump `version` in `package.json`.
3. Commit, then tag `vX.Y.Z` and push the tag.

The release workflow tests the tag, packages the tarball with a build-provenance attestation, stages it on npm with provenance, and creates the GitHub release with the tarball and generated notes. Tags with a hyphen, such as `v0.2.0-rc.1`, are marked as prereleases. npm packages are staged rather than published immediately; promote the staged version on npmjs.com or with `npm stage approve`.
