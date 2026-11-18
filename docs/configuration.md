# Configuration

The presets are declared in [cordis.patch.yml](../cordis.patch.yml) as four `@deepseek-ai/dsh-agent-preset` rows with the ids `preset-codex-inspired`, `preset-codex-extended`, `preset-codex-ptc` and `preset-codex-creator`. Each entry in a preset's `plugins` list is a row that can be changed.

## Changing a row

The preset editor in the DSH web UI provides the simplest path. Saved changes are written to the profile's `cordis.patch.yml`.

Alternatively, the override can be written by hand. A patch that targets the preset row replaces its entire `config`, so the preset should be copied from this package's `cordis.patch.yml`, modified as required, and placed in the profile patch:

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: preset-codex-inspired
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    id: codex
    name: Codex mode
    order: 5
    plugins:
      # the full list from the package, with the desired changes
```

The patch row id stays `preset-codex-inspired`; the preset id in its `config` is now `codex`. The other presets use `codex-extended`, `codex-ptc` and `codex-creator`.

DSH must be restarted afterwards. Sessions that are already open retain the previous preset.

An override can also be tested without modifying the profile by passing it at startup with `dsh --profile web --patch ./my-override.yml`.

## Presets

| Preset id | Display name | Composition |
| --- | --- | --- |
| `codex` | Codex mode | The strict preset: five Codex tools, the `skill` loader and this package's skills, with every host tool hidden. |
| `codex-extended` | Codex+ mode | The same tools, with host tools kept unless their names duplicate a Codex tool. |
| `codex-ptc` | Codex PTC | The Codex tool set reached through `run_code`, plus DSH's standard delegation group. |
| `codex-creator` | Codex Creator | The strict set plus Cordis inspection, the skill loader, and the plugin manager and market tools. |

Codex PTC sets `complete: false` on its persona row so the deployment guidance stays below the Codex prompt, and keeps the free-form patch row disabled because PTC rejects direct tool calls other than `run_code`. Codex Creator's plugin manager and market rows are disabled unless the profile exposes a plugin context.

## Settings

The package also ships a host plugin with the id `@spectershell/dsh-harness-codex`. Its form appears on the bundle's own page in the DSH web UI: open the Plugins page, open the `@spectershell/dsh-harness-codex` bundle, and the form sits between the description and the row list. Saved values are written to the profile, and the preset rows read them on the next request, pre-step or tool sync, so no restart is needed.

The row configuration in [cordis.patch.yml](../cordis.patch.yml) stays the fallback when the host plugin is not mounted, for example in a headless profile.

| Field | Default | Effect |
| --- | --- | --- |
| Free-form apply_patch | Off | Sends `apply_patch` as an OpenAI Responses grammar tool for matching requests. See [freeform.md](freeform.md). |
| Follow the Codex catalog | Off | Also matches models the bundled Codex catalog marks as free-form. |
| Provider and model rules | Empty | The settings page lists the rules and adds them from provider and model dropdowns or a wildcard input. The stored form is one rule per line: `provider:model`, `provider:`, or `:model`. `*` is a glob. Rules add to the preset row's rules. An empty list leaves only the row rules. |
| Tools kept visible | Empty | Comma or space separated tool names that stay visible inside the preset, added to the surface row's `allow` list. |
| Project instruction budget | 32768 | UTF-8 bytes for project instruction files, 1024 to 262144. Overrides the `project-instructions` row's `maxBytes`. |

The free-form switch applies to the running preset: turning it on patches the adapter then, and turning it off restores it. The settings are shared by every session that uses the preset, including sessions that are already open.

## Rows

| Row | Plugin | Notes |
| --- | --- | --- |
| `persona` | `@spectershell/dsh-harness-codex/persona` | Selects the system prompt according to the model. `complete: false` keeps inherited prompt sections. |
| `agent-instructions` | `@deepseek-ai/dsh-agent-instructions` | Loads user-level instruction files. |
| `project-instructions` | `@spectershell/dsh-harness-codex/instructions` | Loads project `AGENTS.md` files with Codex's precedence and 32 KiB budget. |
| `exec` | `@spectershell/dsh-harness-codex/exec` | `exec_command` and `write_stdin`. Disabled on Windows. |
| `patch` | `@spectershell/dsh-harness-codex/patch` | `apply_patch`, ported from Codex's own parser and text updater. Preserves BOM, per-line endings and matched context. |
| `freeform-patch` | `@spectershell/dsh-harness-codex/freeform` | Free-form `apply_patch`, disabled by default. See [freeform.md](freeform.md). |
| `update-plan` | `@spectershell/dsh-harness-codex/plan` | `update_plan`. No options. |
| `view-image` | `@spectershell/dsh-harness-codex/image` | `view_image`. Requires a model with image input. |
| `surface` | `@spectershell/dsh-harness-codex/surface` | Hides tools contributed by the profile. |
| `skill-filesystem` | `@deepseek-ai/dsh-skill-filesystem` | Adds this package's `skills/` directory as a skill root. Codex mode, Codex+ mode and Creator. |
| `tool-skill` | `@deepseek-ai/dsh-tool-skill` | The `skill` loader. Codex mode, Codex+ mode and Creator. |
| `tool-cordis` | `@deepseek-ai/dsh-tool-cordis` | `cordis_inspect_list` and `cordis_inspect_query`. Creator only. |
| `tool-plugin-manager` | `@deepseek-ai/dsh-plugin-manager/tools` | Plugin management tools. Creator only; disabled when no profile context exists. |
| `tool-plugin-market` | `@deepseek-ai/dsh-plugin-market/tools` | Plugin market tools. Creator only; disabled when no profile context exists. |
| `compaction` | `@spectershell/dsh-harness-codex/compaction` | Codex-style local compaction. |
| `delegation` | `cordis:group` | The standard preset's delegation group, isolating `workflowEngine`. Codex PTC only. |
| `tool-executor-ptc` | `@deepseek-ai/dsh-tool-executor-ptc` | Makes `run_code` the only directly callable tool. Codex PTC only. |

### surface

The preset hides every tool registered by the profile, such as `working_directory`, skills and MCP tools. The `allow` list names exceptions that remain visible:

```yaml
- id: surface
  name: @spectershell/dsh-harness-codex/surface
  config:
    allow: [exec_command, write_stdin, apply_patch, update_plan, view_image, skill, web_search]
```

The five Codex tools and `skill` should remain in the list. If the profile registers a tool with the same name as one of them, the preset's own tool takes precedence. An allow-only mask also filters the preset's own rows when an Agent views them, so every tool the preset mounts needs an entry. Codex Creator lists `cordis_inspect_list`, `cordis_inspect_query` and `skill` for that reason.

**Codex+ mode** (`codex-extended`) mounts the same plugins and differs only in the `surface` row, which uses a fixed `deny` list instead of hiding all host tools:

```yaml
- id: surface
  name: @spectershell/dsh-harness-codex/surface
  config:
    deny: [read, write, edit, glob, grep, read_image, bash, pwsh, todo_write]
    allow: [exec_command, write_stdin, apply_patch, update_plan, view_image]
```

In this mode a host tool is hidden only when its name is on the list, so tools from plugins installed later remain available. `allow` still protects the five Codex names, and the preset's own `skill` row is visible because the deny list does not name it. **Codex PTC** (`codex-ptc`) uses the same deny list.

### project-instructions

Project instruction files are loaded with Codex's precedence: within each directory, `AGENTS.override.md` replaces `AGENTS.md`, and optional fallback filenames can be added. Files are read from the project root down to the working directory, up to 32 KiB in total.

```yaml
- id: project-instructions
  name: @spectershell/dsh-harness-codex/instructions
  config:
    maxBytes: 32768
    projectRootMarkers: [.git]
    fallbackFilenames: []
```

## Sandbox and approvals

Commands run under the session's DSH access mode. When a command is blocked, the model may retry it with `sandbox_permissions: "require_escalated"` and a `justification`. DSH then presents an approval prompt to allow that single command outside the sandbox.

## Windows

`exec_command` and `write_stdin` require bash and are disabled on Windows. The remainder of the preset operates normally.
