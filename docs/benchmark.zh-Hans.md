# 基准测试

[English](benchmark.md)

本文在相同模型上对比 Codex-inspired 预设与 DSH 的 Standard 预设。任务、脚本和原始记录见 [eval/](../eval/)。

## 第一轮（2026-11-17）

使用 DSH 0.2.2-rc.1 和 @spectershell/dsh-harness-codex 0.1.0 运行。

- 十个 Python 和 Node 编码任务，既有缺陷修复和跨文件重命名，也有失败的测试、缓慢的导出、交互式安装向导、做到一半的重构，还涉及嵌套的 `AGENTS.md` 规则、824 行的代码库、含义不清的配置和一次日期重构。
- 两个预设：Codex-inspired 与 Standard。
- 两个模型：DeepSeek-V4.1-Flash 使用 High，GPT-6.1-Sol 通过 ChatGPT 订阅使用 Medium。GPT 搭配 Codex-inspired 时启用了 free-form `apply_patch`。
- 每个任务、预设和模型的组合各跑一次，共 40 次运行，每次都使用新会话和任务的全新副本。全程使用完全访问权限，DSH home 独立，没有全局指令。

每个任务都配有一份检查脚本，以及一份用来阅读会话记录的简短评分细则。

### 结果

40 次运行全部通过各自的检查，且都在一轮内完成。

| 预设 | 模型 | 工具调用（总数 / 中位数） | 实际耗时（总数 / 中位数） |
| --- | --- | --- | --- |
| Codex-inspired | DeepSeek-V4.1-Flash | 85 / 8 | 2m 45s / 13.5 s |
| Standard | DeepSeek-V4.1-Flash | 117 / 12 | 2m 51s / 15.5 s |
| Codex-inspired | GPT-6.1-Sol | 50 / 5 | 6m 16s / 36 s |
| Standard | GPT-6.1-Sol | 149 / 15.5 | 11m 16s / 67 s |

在 GPT 上，Codex-inspired 的工具调用次数只有 Standard 的三分之一，耗时约为 Standard 的一半。它的运行用一条命令读完多个文件，再一次打补丁，Standard 则采取更多更小的步骤。在 DeepSeek 上，Codex-inspired 的调用次数少 27%，实际耗时基本持平。

Codex-inspired 在两个模型上用的 token 也更少，约为 Standard 的三分之一。四组数据的 token 统计方式不同，方向可信，幅度只是近似值。每次运行的数字见 [eval/round-1/results.md](../eval/round-1/results.md)。

### 评分细则观察

每次运行都先读代码再修改，改动保持精简，报告内容仅限于实际运行过的命令。没有运行碰过诱饵文件。

最薄弱的地方是修复前先复现故障。GPT 搭配 Codex-inspired 时在两个任务上跳过了这一步，重构任务中也没有一次运行清楚地复现出错误。

两个预设处理长时间命令和交互式命令的方式不同。Codex-inspired 用 `write_stdin` 继续进程，或者通过 TTY 回答向导，Standard 则使用后台任务和管道输入。两种做法都成功了。

### 局限

所有运行都通过，这一轮在正确性上分不出两个预设的差别。每个单元格只有一次运行，任务规模偏小，也没有在审批模式下运行。free-form 补丁桥接只在一个分组启用，那个分组的部分优势可能来自桥接。完整分析见 [eval/round-1/analysis.md](../eval/round-1/analysis.md)。

## 第二轮（2026-11-18）

使用 DSH 0.2.2-rc.3 和提交 `4a0f9bf` 处的 @spectershell/dsh-harness-codex 运行。模型与第一轮相同，条件更严格。

- 为本轮构建的十个任务：只在检查时才复制进来的隐藏测试、必须保持字节完全一致的受保护文件、一个多轮任务、两个在 Workspace Write 下运行的任务、一个 dev-server 生命周期任务、一个确实不稳定的测试套件，以及两个大型 fixture。
- 五个单元格：DeepSeek-V4.1-Flash（High）上的 Codex-inspired 与 Standard，GPT-6.1-Sol（Medium）上的 Codex-inspired 与 Standard，以及一个消融单元格，重复 Codex-inspired 的 GPT 配置并关闭 free-form `apply_patch` 覆盖层。
- 每个任务和单元格重复三次，共 150 次运行，每次都使用新会话和任务的全新副本。同一时间只有一个任务在运行，任务不联网，访问模式从每个任务的 `access.txt` 读取。

### 结果

| 单元格 | 预设 | 模型 | 通过数 | 工具调用（中位数） | 输入 token（中位数） | 输出 token（中位数） | 实际耗时（中位数） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CI-DS | Codex-inspired | DeepSeek-V4.1-Flash | 30/30 | 16.5 | 6,453 | 7,948.5 | 49.0 s |
| ST-DS | Standard | DeepSeek-V4.1-Flash | 30/30 | 21 | 8,661 | 10,032 | 62.6 s |
| CI-GPT | Codex-inspired | GPT-6.1-Sol | 30/30 | 6.5 | 11,626 | 2,519 | 82.1 s |
| ST-GPT | Standard | GPT-6.1-Sol | 29/30 | 24.5 | 24,389 | 3,138 | 144.5 s |
| ABL-GPT | Codex-inspired，关闭桥接 | GPT-6.1-Sol | 30/30 | 6.5 | 14,068.5 | 2,881.5 | 89.35 s |

中位数取每个单元格内十个任务中位数的中位数，并非各任务求和。任务规模差异很大，求和结果会被其中两个任务主导。原始运行记录和各任务的中位数见 [eval/round-2/results.md](../eval/round-2/results.md)。

150 次运行中 149 次通过。未通过的是 GPT 搭配 Standard 时 05-flaky-reconcile 的第 2 次重复。修复和证据都正确，但 `docs/testing.md` 里记录的命令把种子循环包在 `$(... 2>&1)` 中，检查脚本提取后变成了 `python3 -m unittest discover -s tests 2`。

GPT 上两个预设差距很大，Codex-inspired 的工具调用约为 Standard 的四分之一，实际耗时约为一半。DeepSeek 上差距较小，16.5 次对 21 次调用，49.0 秒对 62.6 秒。各项陷阱都守住了。受保护文件在每个单元格里都保持不变，任务 06 用脚本自身的报错拒绝了越界路径，sentinel 文件始终没有出现，没有运行请求升级权限，dev server 启动并停止后端口 48173 处于空闲状态，不稳定的测试套件在修改前用种子做了诊断，追问在第一轮对话的基础上得到回答，7 MB 的日志从未被打印。

消融单元格与 CI-GPT 逐次运行结果一致，通过数同为 30/30，调用次数中位数也相同。唯一能观察到的差别在 `apply_patch` 的传输编码上：启用桥接时调用 id 是 `ctc_` 前缀，关闭时是 `fc_` 前缀，记录下来的工具 schema 在两种情况下相同。在这套任务上，free-form 桥接没有产生影响。

完整分析见 [eval/round-2/analysis.md](../eval/round-2/analysis.md)，其中包括各项陷阱的结果，以及针对协议得到的 harness 结论。
