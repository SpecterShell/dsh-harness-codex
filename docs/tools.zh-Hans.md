# 工具

[English](tools.md)

预设提供五个 Codex 工具。工具的名称、参数和输出文本沿用 Codex，为 Codex 训练过的模型可以直接使用。Codex PTC 在 `run_code` 里调用它们，Creator 还会额外提供自己的工具。

## exec_command

在新进程中运行一条 Shell 命令并返回输出。命令在等待结束时仍在运行的，返回会话标识符而不返回退出码，会话继续在后台运行。

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `cmd` | string | 必填 | 要执行的 Shell 命令。 |
| `workdir` | string | 当前工作目录 | 命令的工作目录。 |
| `tty` | boolean | `false` | 为 `true` 时分配 PTY；省略或为 `false` 时使用普通管道。 |
| `yield_time_ms` | number | 10000 | 返回输出前的等待时间。有效范围是 250–30000 毫秒。 |
| `max_output_tokens` | number | 10000 | 输出的 token 预算。更大的请求会被截断。 |
| `sandbox_permissions` | string | `use_default` | 设为 `require_escalated` 时，经用户批准后在沙箱外重试该命令。仅在部署启用了命令沙箱时存在。 |
| `justification` | string | — | 面向用户的一句话说明，配合 `require_escalated` 必填。 |

每次调用都启动一个新进程：`cd`、导出的变量和 Shell 函数不会带入下一次调用。输出按增量收集，同一会话的多次回复不会重复也不会丢失内容。每个进程的输出上限是 1 MiB，每次回复按 token 预算以 Codex 的格式截断，保留开头和结尾。

### 示例

#### 快速命令

在等待时间内结束的命令返回退出码和输出。

输入

```json
{
  "cmd": "git status --short"
}
```

输出

```text
Wall time: 0.1200 seconds
Process exited with code 0
Original token count: 3
Output:
 M src/app.ts
```

#### 命令仍在运行

超过等待时间仍在运行的命令返回会话标识符，会话在后台继续。

输入

```json
{
  "cmd": "for i in 1 2 3; do echo tick $i; sleep 4; done",
  "yield_time_ms": 250
}
```

输出

```text
Wall time: 0.2500 seconds
Process running with session ID 15893
Original token count: 6
Output:
tick 1
```

命令结束后，回复带有 `Process exited with code N`，不再有会话标识符。

### 特殊情况

- 两次调用各自独立，一次调用里的 `cd` 或导出变量对另一次不可见。
- 第一次等待期间取消调用会终止进程。取消 `write_stdin` 的轮询则让进程继续运行。

## write_stdin

轮询运行中的会话获取新输出，或向以 `tty: true` 启动的会话发送输入。

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `session_id` | number | 必填 | 运行中的 `exec_command` 回复里的标识符。 |
| `chars` | string | 空 | 写入会话的字节。为空时只轮询不写入。 |
| `yield_time_ms` | number | 250 | 返回前的等待时间。写入时上限为 30000 毫秒；空轮询限制在 5000–300000 毫秒。 |
| `max_output_tokens` | number | 10000 | 输出的 token 预算。 |

会话属于启动它的 Agent，会话标识符不能在其他 Agent 中使用。非 TTY 会话的 stdin 是关闭的：写入普通文本会失败，单独发送控制字符 `Ctrl-C` 会结束进程。已结束的会话保留最终输出供最后一次轮询，之后被移除。一个 Agent 最多持有 64 个会话；超过上限时最旧的会话被终止，Agent 结束或预设卸载时，它留下的所有会话都会被终止。

回复的格式与 `exec_command` 相同，输出部分是该会话自上次回复以来产生的内容。

### 示例

#### 轮询直到退出

以上一个示例的会话为例，用空的 `chars` 轮询会返回剩余的输出，然后是退出码。

输入

```json
{
  "session_id": 15893,
  "chars": "",
  "yield_time_ms": 10000
}
```

输出

```text
Wall time: 8.0000 seconds
Process exited with code 0
Original token count: 12
Output:
tick 2
tick 3
```

#### 向 TTY 会话写入

以 `tty: true` 启动的会话接受输入。非 TTY 会话会拒绝普通输入，报 `stdin is closed`。

输入

```json
{
  "session_id": 31020,
  "chars": "codex\n",
  "yield_time_ms": 5000
}
```

输出

```text
Wall time: 0.3500 seconds
Process exited with code 0
Original token count: 11
Output:
codex hello codex
```

### 特殊情况

- 属于其他 Agent 的会话标识符会被拒绝，进程已被回收的标识符同样被拒绝。
- `chars` 整体为 `Ctrl-C` 时会结束非 TTY 会话，而不是报错。

## apply_patch

用 Codex 补丁创建、更新、移动和删除 UTF-8 文本文件：

```text
*** Begin Patch
*** Update File: src/app.ts
@@
-const old = true
+const old = false
*** End Patch
```

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `input` | string | 必填 | 补丁文本。 |
| `sandbox_permissions` | string | `use_default` | 设为 `require_escalated` 时，经用户批准后在沙箱外重试该补丁。仅在部署启用了文件写入沙箱时存在。 |
| `justification` | string | — | 面向用户的一句话说明，配合 `require_escalated` 必填。 |

语法支持 `*** Add File`、`*** Update File`、`*** Delete File` 和 `*** Move to:`。整个补丁先校验再写入，校验失败的补丁不会改动任何文件。开始写入后，操作按顺序执行，遇到第一个失败就停止；失败不会回滚，报告里会列出已经改动的内容：

```text
Success. Updated the following files:
A src/util.ts
M src/app.ts
```

部分失败时，报告先列出已完成的操作，再列出失败的操作及其在补丁中的行号，最后是未执行的操作。

实现是本包自己的移植，取自 Codex 的补丁解析器和文本更新器，接在 DSH 的文件系统服务和沙箱上。行为遵循 Codex 的规则：保留 UTF-8 BOM，源文件的每一行各自保留原来的行尾（CRLF、LF 或单独的 CR），替换或新增的行取文件的第一个行尾，经模糊匹配命中的上下文行沿用文件里的原写法，空补丁会被拒绝，标有 `*** End of File` 的插入落在文件真正的最后一行之后。JSON 的 `input` 字段、权限检查和结构化结果沿用 DSH。启用 free-form 桥接后，GPT 模型会以 Codex 的语法工具形式收到这个工具，详见 [freeform.zh-Hans.md](freeform.zh-Hans.md)。

## update_plan

替换会话的计划，显示在待办面板中。

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `plan` | array | 必填 | 步骤列表。每项包含 `step` 文本和 `status`，取值为 `pending`、`in_progress` 或 `completed`。 |
| `explanation` | string | — | 可选，对本次计划更新的说明。 |

回复是 `Plan updated`。计划存储在 DSH 的待办投影中，所以会显示在待办面板里，也会随会话重放保留。

### 示例

#### 更新计划

输入

```json
{
  "plan": [
    { "step": "检查失败的测试", "status": "completed" },
    { "step": "修复缺陷", "status": "in_progress" },
    { "step": "运行测试", "status": "pending" }
  ]
}
```

输出

```text
Plan updated
```

### 特殊情况

- 允许同时有多个步骤处于 `in_progress`，与 Codex 的处理一致。

## view_image

读取本地图片文件并附加到对话中，让模型查看。

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `path` | string | 必填 | 图片文件的本地路径。 |

支持 PNG、JPEG、WebP 和 GIF，受部署的大小和像素限制约束。不支持图片输入的模型会被拒绝。图片被缩放时，回复会给出缩放系数，便于把坐标换算回原图。回复以附件形式携带图片，并附一段文本：

```text
<path>/tmp/diagram.png</path>
<type>image</type>
<content>
image/png image, 96x96 px, 356 bytes
</content>
```

### 示例

#### 查看图片

输入

```json
{
  "path": "/tmp/workspace/diagram.png"
}
```

输出

```text
<path>/tmp/workspace/diagram.png</path>
<type>image</type>
<content>
image/png image, 96x96 px, 356 bytes
</content>
```

模型会随回复收到这张图片附件。

### 特殊情况

- 文件不存在、内容不是图片，或图片超出部署限制时，会以相应原因拒绝。
