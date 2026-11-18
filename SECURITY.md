# Security policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please do not open a public issue. Vulnerabilities should be reported through [GitHub's private vulnerability reporting](https://github.com/SpecterShell/dsh-harness-codex/security/advisories/new). A reply should be expected within a week.

Useful information includes the package version, the DSH version, the provider and model, and the steps or session log that demonstrate the problem.

## Scope

This package runs commands on the user's machine on behalf of the agent. They pass through DSH's sandbox and approval settings; a command that escapes them is treated as a security bug in this package, as is a session that one agent can read or drive from another.

Problems in DSH itself, its sandbox or a model provider belong to those projects.

## Verifying a release

Each release is published with npm provenance, and the tarball attached to the GitHub release carries a build provenance attestation:

```sh
npm audit signatures
gh attestation verify dsh-harness-codex-X.Y.Z.tgz --repo SpecterShell/dsh-harness-codex
```
