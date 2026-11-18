/**
 * Package root: the host entry DSH loads for the preset's settings.
 *
 * The source module is `./host.ts`; tsc emits this barrel as `lib/index.js`,
 * which is what `main` and the `.` export point at. Cordis finds the named
 * `apply` and `Config` exports through the re-export.
 * @module @spectershell/dsh-harness-codex
 */
export * from './host.js'
