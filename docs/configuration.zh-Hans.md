# 配置

[English](configuration.md)

预设在本包的 [cordis.patch.yml](../cordis.patch.yml) 里声明为一行 `@deepseek-ai/dsh-agent-preset`，id 为 `preset-codex-inspired`。`plugins` 列表中的每一条都是一行，都可以修改。

## 修改某一行

DSH Web 界面里的预设编辑器是最省事的做法，保存后的改动会写入 profile 的 `cordis.patch.yml`。

也可以手写覆盖。针对预设这一行的补丁会替换整个 `config`，所以做法是从本包的 `cordis.patch.yml` 复制该预设，按需修改，再放进 profile 的补丁文件：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: preset-codex-inspired
  name: '@deepseek-ai/dsh-agent-preset'
  config:
    id: codex-inspired
    name: Codex-inspired
    order: 5
    plugins:
      # the full list from the package, with the desired changes
```

之后必须重启 DSH。已经打开的会话仍沿用旧的预设。

不修改 profile 也能试一下覆盖补丁，启动时用 `dsh --profile web --patch ./my-override.yml` 传入即可。

## 设置

本包还提供一个宿主插件，id 是 `@spectershell/dsh-harness-codex`。设置表单出现在 DSH Web 界面的插件页里：打开插件页，进入 `@spectershell/dsh-harness-codex` 的详情页，表单就在描述和行列表之间。保存的值会写入 profile，预设各行在下一次请求、下一步或下一次工具同步时读取，不需要重启。

宿主插件没有挂载时，比如在 headless profile 里，仍然以 [cordis.patch.yml](../cordis.patch.yml) 里的行配置为准。

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| 自由格式 apply_patch | 关闭 | 对匹配的请求把 `apply_patch` 作为 OpenAI Responses 语法工具发送。见 [freeform.zh-Hans.md](freeform.zh-Hans.md)。 |
| 跟随 Codex 模型目录 | 关闭 | 内置 Codex 目录标记为自由格式的模型也一并匹配。 |
| 服务商与模型规则 | 空 | 设置页以列表管理规则，可以从服务商和模型的下拉菜单添加，也可以用支持通配符的输入框。存储形式是每行一条规则：`provider:model`、`provider:` 或 `:model`。`*` 是通配符。规则会追加到预设行的规则后面，留空则只用行配置里的规则。 |
| 保留可见的工具 | 空 | 用逗号或空格分隔的工具名，在预设内保持可见，并与 surface 行的 `allow` 列表叠加。 |
| 项目指令预算 | 32768 | 项目指令文件的 UTF-8 字节数，范围 1024 到 262144。会覆盖 `project-instructions` 行的 `maxBytes`。 |

自由格式开关对正在运行的预设生效：打开时立刻给适配器打补丁，关闭时立刻恢复。这些设置由使用该预设的所有会话共享，包括已经打开的会话。

## 行

| 行 | 插件 | 说明 |
| --- | --- | --- |
| `persona` | `@spectershell/dsh-harness-codex/persona` | 根据模型选择系统提示词。没有选项。 |
| `agent-instructions` | `@deepseek-ai/dsh-agent-instructions` | 加载用户级指令文件。 |
| `project-instructions` | `@spectershell/dsh-harness-codex/instructions` | 按 Codex 的优先级和 32 KiB 预算加载项目的 `AGENTS.md` 文件。 |
| `exec` | `@spectershell/dsh-harness-codex/exec` | `exec_command` 和 `write_stdin`。在 Windows 上禁用。 |
| `tool-fs` | `@deepseek-ai/dsh-tool-fs` | 只启用 `applyPatch`。 |
| `freeform-patch` | `@spectershell/dsh-harness-codex/freeform` | Free-form 形式的 `apply_patch`，默认关闭。见 [freeform.zh-Hans.md](freeform.zh-Hans.md)。 |
| `update-plan` | `@spectershell/dsh-harness-codex/plan` | `update_plan`。没有选项。 |
| `view-image` | `@spectershell/dsh-harness-codex/image` | `view_image`。需要支持图片输入的模型。 |
| `surface` | `@spectershell/dsh-harness-codex/surface` | 隐藏 profile 提供的工具。 |
| `compaction` | `@spectershell/dsh-harness-codex/compaction` | Codex 风格的本地压缩。 |

### surface

预设会隐藏 profile 注册的所有工具，例如 `working_directory`，以及 skills 和 MCP 工具。`allow` 列表列出仍然可见的例外：

```yaml
- id: surface
  name: @spectershell/dsh-harness-codex/surface
  config:
    allow: [exec_command, write_stdin, apply_patch, update_plan, view_image, web_search]
```

五个 Codex 工具应当留在列表里。如果 profile 注册了与其中某个工具同名的工具，预设自带的那个优先。

本包还声明了第二个预设 **Codex-extended**（`codex-extended`）。它挂载同一批插件，只有 `surface` 行不同，用固定的 `deny` 列表代替隐藏全部宿主工具：

```yaml
- id: surface
  name: @spectershell/dsh-harness-codex/surface
  config:
    deny: [read, write, edit, glob, grep, read_image, bash, pwsh, todo_write]
    allow: [exec_command, write_stdin, apply_patch, update_plan, view_image]
```

这种模式下，宿主工具只有名字在列表里才会被隐藏，之后安装的插件提供的工具仍然可用。`allow` 依旧保护五个 Codex 工具名。

### project-instructions

项目指令文件按 Codex 的优先级加载：同一目录下 `AGENTS.override.md` 取代 `AGENTS.md`，还可以添加备用的文件名。文件从项目根目录一路读到工作目录，总量上限 32 KiB。

```yaml
- id: project-instructions
  name: @spectershell/dsh-harness-codex/instructions
  config:
    maxBytes: 32768
    projectRootMarkers: [.git]
    fallbackFilenames: []
```

## 沙箱与审批

命令按会话的 DSH 访问模式运行。若命令被拦截，模型可以用 `sandbox_permissions: "require_escalated"` 加一段 `justification` 重试。随后 DSH 会给出审批请求，允许这一条命令在沙箱外运行。

## Windows

`exec_command` 和 `write_stdin` 依赖 bash，在 Windows 上禁用。预设的其他部分照常工作。
