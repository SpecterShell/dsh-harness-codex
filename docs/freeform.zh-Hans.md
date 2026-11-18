# Free-form 补丁

[English](freeform.md)

Codex 把 `apply_patch` 作为带 Lark 语法的自定义工具提供给 GPT 模型：模型直接产出原始补丁，API 再按语法约束输出内容。DSH 只支持 JSON 函数工具，所以本预设的 `apply_patch` 默认把补丁作为名为 `input` 的 JSON 字符串字段接收。

`freeform-patch` 这一行改发 Codex 的形式，作用于其规则选中的服务方和模型。凡是使用 OpenAI Responses API 的路由都支持。

## 设置

```yaml
- id: freeform-patch
  name: @spectershell/dsh-harness-codex/freeform
  config:
    enabled: false
    rules:
      - provider: openrouter
        model: openai/gpt-*
      - provider: openai-codex
      - model: gpt-6*
    codexCatalog: false
```

一条规则可以指定服务方，可以指定模型，也可以两者都指定。省略的字段匹配任何值，`*` 是通配符。

`codexCatalog: true` 会为 Codex 自身目录里的每个模型启用桥接，按 Codex 的前缀规则匹配。例如 `openai/gpt-6.1-sol` 会被当作 `gpt-6.1-sol`。

改某一行的步骤见 [configuration.zh-Hans.md](configuration.zh-Hans.md)。

### ChatGPT 订阅

[dsh-codex-subscription](https://www.npmjs.com/package/dsh-codex-subscription) 注册服务方 `openai-codex`：

```yaml
rules:
  - provider: openai-codex
```

### OpenRouter

OpenRouter 的路由需要配置成 `api: openai-responses` 和 `baseURL: https://openrouter.ai/api/v1`，配置完成后再这样写：

```yaml
rules:
  - provider: openrouter
    model: openai/gpt-*
```

建议先只拿一个模型试，有些网关会拒绝自定义工具。

### 其他 Responses 端点

有些服务方为 Codex 本身就提供了这类配置文档，例如 [z.ai 的指南](https://docs.z.ai/devpack/tool/codex)。路由以 `api: openai-responses` 添加，然后按名称匹配：

```yaml
rules:
  - provider: zai
    model: glm-5.3
```

`codexCatalog` 只覆盖 OpenAI 的模型，其他服务方必须显式写规则。

## 工作原理

会话历史不会被改动。DSH 仍会把每次 `apply_patch` 调用记录为 `{"input": "<patch>"}`。转换只作用于发往服务方的请求和返回的回复。会话因此可以在任意时刻从 GPT 模型切换到其他服务方。

桥接只处理使用本预设的 Agent 发出的请求，并且要求规则匹配、路由走 Responses API（`openai-responses`、`openai-codex-responses` 或 `azure-openai-responses`）。其他预设不受影响。

模型无视语法、仍用 JSON 包装补丁时，存储前会拆掉外层包装。

## 注意事项

DSH 没有公开的自定义工具发送机制，桥接改动的是 DSH 内部 pi-ai 适配器的两个方法。已在 `@deepseek-ai/dsh-llm-pi-ai` 0.2.2-rc.1 和 0.2.2-rc.3 上测试，两者都搭配 pi-ai 1.5.2。若之后的 DSH 版本改动了这两个方法，桥接会记录一条警告，`apply_patch` 仍按 JSON 函数处理。

ChatGPT 订阅路由经过人工验证。Azure 路由尚未测试。

模型流式输出 JSON 包装的补丁时，流式预览可能短暂显示外层包装。已存储的调用不受影响。

## 关闭

设置 `enabled: false`，或者删掉这一行。没有预设再使用桥接时，适配器恢复正常。
