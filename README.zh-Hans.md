# @spectershell/dsh-harness-codex

[![CI](https://github.com/SpecterShell/dsh-harness-codex/actions/workflows/ci.yml/badge.svg)](https://github.com/SpecterShell/dsh-harness-codex/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@spectershell/dsh-harness-codex)](https://www.npmjs.com/package/@spectershell/dsh-harness-codex)

[English](README.md)

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供的 Agent 预设，复现 OpenAI Codex 的工作方式。Agent 通过 Shell 读取和搜索，用 `apply_patch` 修改文件，每条命令都在独立进程中运行。工具名称、参数结构、输出格式和提示词均沿用 Codex，GPT 模型因此能按训练时的习惯工作。其他模型拿到同一套工具，配套的提示词另行编写。

## 安装

```sh
dsh plugin --profile web add @spectershell/dsh-harness-codex
```

重启 DSH 后，新建会话时可以选择 **Codex mode**、**Codex strict mode**、**Codex PTC** 和 **Codex Creator** 预设。本包要求 DSH 0.2.2-rc.1 或之后的 0.2 版本，以及 Node.js 24.9 或更新版本。

## 功能

### 预设

| 预设 | 说明 |
| --- | --- |
| **Codex mode** | 同一套 Codex 工具，外加宿主中不冲突的工具。<ul><li>只隐藏与 Codex 工具重复的内置工具（`read`、`write`、`edit`、`glob`、`grep`、`read_image`、`bash`、`pwsh`、`todo_write`）</li><li>其余工具照常可用，包括之后安装的插件提供的工具</li><li>用于委派的子 Agent、消息和工作流</li></ul> |
| **Codex strict mode** | 严格的预设，模型只能看到 Codex 工具。<ul><li>五个 Codex 工具，外加加载本包自带技能的 `skill` 工具</li><li>其他 profile 插件提供的工具都会被隐藏</li><li>用于委派的子 Agent、消息和工作流</li></ul> |
| **Codex PTC** | 同一套 Codex 工具，改成在程序里调用。<ul><li>`run_code` 是唯一可以直接调用的工具，所有 Codex 工具都在程序内可用</li><li>带有 DSH 标准预设中的委派组，`subagent`、`subagent_fork` 和 `workflow` 也能在程序里使用</li><li>persona 保留继承的提示词段落而不替换它们，free-form 补丁桥保持关闭，因为 PTC 会拒绝 `run_code` 之外的直接工具调用</li></ul> |
| **Codex Creator** | 严格工具集，外加编写 DSH 插件的工具。<ul><li>查询实时运行时接口的 `cordis_inspect_list` 和 `cordis_inspect_query`</li><li>`skill` 加载器</li><li>profile 提供插件上下文时的插件管理和插件市场工具</li></ul> |

用户级和项目级的 `AGENTS.md` 在四个预设中都照常生效。

### 工具

| 工具 | 说明 |
| --- | --- |
| `exec_command` | 在新进程中运行命令。返回输出，命令尚未结束则返回会话标识符。 |
| `write_stdin` | 轮询正在运行的会话，或向以 `tty: true` 启动的会话发送输入。 |
| `apply_patch` | 用 Codex 补丁修改文件。 |
| `update_plan` | 更新待办面板中显示的计划。 |
| `view_image` | 让模型查看本地图片。 |

参数和行为细节见 [docs/tools.zh-Hans.md](docs/tools.zh-Hans.md)。Codex mode、Codex strict mode 和 Codex Creator 还会提供 `skill`。

### 技能

本包附带 `review-agent` 技能，改编自 Codex 的 review-agent 示例，按 Apache License 2.0 授权，出处见 [NOTICE](NOTICE)。Codex mode、Codex strict mode 和 Codex Creator 预设挂载的技能提供方指向本包的 [skills/](skills/) 目录，需要审阅改动时模型可以加载这套审阅方法。PTC 预设不挂载技能相关行：PTC 只接受 `run_code` 作为直接调用，在程序里取回的说明只会进入程序结果，不会作为技能指令送到模型。Codex 自带的其他技能（图片生成、OpenAI 产品文档、TUI 状态栏）依赖 DSH 没有的 Codex 功能，因此不在移植范围内，通过 ChatGPT 订阅生成图片已由 dsh-codex-subscription 覆盖。

### 提示词

预设按模型选择系统提示词。GPT 模型使用 Codex 目录中该模型对应的提示词，其他模型使用 [prompts/original.md](prompts/original.md)。

| 文件 | 用途 |
| --- | --- |
| [prompts/original.md](prompts/original.md) | 所有非 OpenAI 模型 |
| [prompts/codex/prompt.md](prompts/codex/prompt.md) | 目录之外的 OpenAI 系模型 |
| [prompts/codex/gpt-5.5.md](prompts/codex/gpt-5.5.md) | gpt-5.5 |
| [prompts/codex/gpt-5.6-sol.md](prompts/codex/gpt-5.6-sol.md) | gpt-5.6-sol、gpt-5.6-terra、gpt-5.6-luna、codex-auto-review、gpt-daybreak-blue-latest |
| [prompts/codex/gpt-6-astra.md](prompts/codex/gpt-6-astra.md) | gpt-6-astra、gpt-6.1-terra |
| [prompts/codex/gpt-6-luna.md](prompts/codex/gpt-6-luna.md) | gpt-6-luna |
| [prompts/codex/gpt-6-sol.md](prompts/codex/gpt-6-sol.md) | gpt-6-sol |
| [prompts/codex/gpt-6.1-sol.md](prompts/codex/gpt-6.1-sol.md) | gpt-6.1-sol |
| [prompts/codex/gpt-6.2-sol.md](prompts/codex/gpt-6.2-sol.md) | gpt-6.2-sol、gpt-6.2-astra |
| [prompts/codex/gpt-daybreak-red-latest.md](prompts/codex/gpt-daybreak-red-latest.md) | gpt-daybreak-red-latest |
| [prompts/codex/compact-prompt.md](prompts/codex/compact-prompt.md) | 压缩上下文时的请求 |
| [prompts/codex/compact-summary-prefix.md](prompts/codex/compact-summary-prefix.md) | 压缩摘要的前缀 |

目录文件由 Codex 检出生成，方法见 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 指令文件

项目指令文件按 Codex 的优先级加载：同一目录下 `AGENTS.override.md` 优先于 `AGENTS.md`，从项目根目录逐级读到工作目录，总量不超过 32 KiB。用户级文件仍由 DSH 加载，项目文件每一步都会重新读取。

### Free-form 补丁

Codex 向 GPT 模型提供 `apply_patch` 的方式是带语法约束的 free-form 工具，并非 JSON 函数。只要服务方支持 OpenAI Responses API，本包就能复现这一行为，ChatGPT 订阅、OpenRouter 和兼容端点都包括在内。该功能默认关闭，详见 [docs/freeform.zh-Hans.md](docs/freeform.zh-Hans.md)。

### 压缩

预设把 DSH 自带的压缩引擎替换为一个遵循 Codex 规则的本地引擎。上下文接近模型窗口的 90% 时，历史会被替换为一份摘要加上 20,000 token 以内的最新用户消息。`/compact` 用的是同一套引擎。自动压缩如果不会缩小上下文就会被跳过，摘要失败时上下文保持不变。

本包不提供云端压缩。服务端压缩属于服务商插件的职责，ChatGPT 订阅已由 [dsh-codex-subscription](https://github.com/WSL043/dsh-codex-subscription) 提供。

## 设置

本插件的设置表单会显示在 DSH 设置页和「插件」里本插件的详情页中，包含 free-form 补丁的开关和规则、surface 的允许列表，以及项目指令的字节预算。保存后立即生效，不需要重启。同样的值也以 JSON 形式提供在 `/codex/settings.json`，供诊断使用。各字段的说明见 [docs/configuration.zh-Hans.md](docs/configuration.zh-Hans.md)。

## 文档

- [工具](docs/tools.zh-Hans.md)
- [配置](docs/configuration.zh-Hans.md)
- [Free-form 补丁](docs/freeform.zh-Hans.md)
- [与 Codex 的差异](docs/differences.zh-Hans.md)
- [基准测试](docs/benchmark.zh-Hans.md)
- [更新日志](CHANGELOG.md)

## 开发

```sh
pnpm install
pnpm build
pnpm test
```

测试要求本机已安装 DSH（`npm install -g @deepseek-ai/dsh`）。把本地构建链接到测试 profile、运行评测的方法见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可

[Apache-2.0](LICENSE)。随包附带的 Codex 素材的出处说明见 [NOTICE](NOTICE)。
