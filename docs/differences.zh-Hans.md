# 与 Codex 的差异

[English](differences.md)

本预设跟随 [OpenAI Codex](https://github.com/openai/codex) 的 [ca21fe65](https://github.com/openai/codex/tree/ca21fe65d18a9b6326759fb4263c65dfbb645aa5) 提交。它运行在 DeepSeek Harness 之内，使用 DSH 的 Agent 循环、沙箱和审批机制，因此有些行为与 Codex 不同。下面逐项说明原因。

## exec_command 与 write_stdin

- 没有 `shell` 和 `login` 选项，因为 DSH 的 Shell 服务固定使用 bash，也没有登录模式。
- `prefix_rule` 和 `with_additional_permissions` 同样没有，因为 DSH 的审批没有对应的机制。
- `require_escalated` 在审批通过后以 DSH 的 `danger-full-access` 模式运行这一条命令。这是 DSH 中最接近 Codex 无沙箱执行的一种模式。
- 没有 TTY 时，stderr 排在 stdout 之后输出，不与它交错，因为 DSH 分别返回这两个流。
- token 数按字节数除以 4 向上取整，与 Codex 的算法一致。DSH 的 token 计量只统计完整消息。
- 会话归属于启动它的 Agent。插件的一份副本服务所有使用该预设的 Agent，因此别的 Agent 用不了这个会话标识符。
- 在非 TTY 会话上，`write_stdin` 把单独的 Ctrl-C（`\u0003`）映射为终止进程。Codex 发送的是 SIGINT，DSH 的 Shell 服务只提供终止操作，信号因此不同。

## apply_patch

默认情况下 `apply_patch` 是带 `input` 字段的 JSON 函数。Codex 给 GPT 模型的是带语法约束的 free-form 工具。Codex 的形式可以按服务方和模型分别启用，见 [freeform.zh-Hans.md](freeform.zh-Hans.md)。

## update_plan 与 view_image

- `update_plan` 接受多个标记为 `in_progress` 的步骤。Codex 的工具说明要求只留一个，但它的处理函数接受更多，本适配器以处理函数为准。
- `view_image` 只接受 `path`。Codex 对某些模型会附加 `detail` 和 `environment_id`，DSH 没有对应机制。

## 提示词

GPT 模型使用 Codex 模型目录中为该模型准备的那份提示词。无法识别的 GPT 系列模型使用 Codex 的兜底提示词。其他模型一律使用 [prompts/original.md](../prompts/original.md)，因为 Codex 的提示词描述的是 Codex 自身。

Codex 的提示词会提到本预设没有提供的 Codex 功能，例如托管的网页搜索。

## 指令与上下文

- DSH 保留两个用户级指令根目录，即 `~/.dsh/AGENTS.md` 和共享的 agents 主目录。Codex 只读一个 Codex 主目录，并优先读 `AGENTS.override.md`。
- Codex 把用户文档和项目文档合并成一个 `# AGENTS.md instructions` 块。本预设里它们以各自独立的 system-reminder 消息送达，项目消息以 `--- project-doc ---` 开头。
- 项目文档无论项目是否受信任都会加载，每一步都重新读取。Codex 会跳过不受信任的项目，只在环境选择变化时重新读取项目文档。
- 项目文档的预算是 32 KiB，与 Codex 相同。DSH 还对用户级文件额外套用 32 KiB 的限制；Codex 对用户指令不设预算。
- 如果预算正好切在多字节字符中间，本预设会退到这个字符之前。Codex 直接按字节截断，可能显示替换字符。
- 压缩遵循 Codex 的本地规则：模型先收到一段摘要，然后按时间顺序收到能放进 20,000 token 的最新原始用户消息。工具结果和其他步骤会被丢弃，旧摘要会被替换，不会作为用户消息保留。DSH 开头的 system 和 developer 消息原位保留，不会按会话配置重建。
- 上下文达到模型窗口的 90% 时，自动压缩会在该步开始前执行。Codex 还能在单独的轮次结束阈值处压缩，或者放到后台压缩，本预设把这些都留到步骤边界处理。触发本轮的那条提示词尚未出现在会话界面上，因此会排在摘要之后送达，不会被算作保留下来的用户消息。压缩无法缩小上下文时，自动压缩会跳过；手动压缩则总会执行。
- profile 提供的工具都被隐藏，模型只看到 Codex 的这套工具。可以放行例外，见 [configuration.zh-Hans.md](configuration.zh-Hans.md)。
