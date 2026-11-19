# Compaction

[简体中文](compaction.zh-Hans.md)

Long conversations are compacted so work can continue within the model's context window. This preset replaces DSH's own engine with a local one that follows Codex's rule: the model receives a summary, then the newest original user messages that fit in a fixed budget.

![Compaction](figures/compaction.svg)

The example shows five user messages U1 to U5 and three assistant steps A1 to A3 with tool results R1 to R3. After compaction, the context keeps the system and developer messages, the user messages that fit the budget, and one summary. The assistant steps and tool results are gone.

## How it works

Compaction runs before a step when the estimated context reaches 90% of the model's window, and on demand through `/compact`.

The engine asks the model to summarize the compactable range of the conversation, using Codex's compaction prompt. It then rebuilds the context:

1. Leading system and developer messages stay in place.
2. The newest original user messages that fit in 20,000 tokens are kept, in chronological order. Text is counted as UTF-8 bytes divided by four, and a message that crosses the boundary keeps its head and tail with a `…N tokens truncated…` marker.
3. A single summary message, marked with Codex's summary prefix, follows the kept messages.

Tool results, assistant steps and everything else in the range are dropped. An earlier summary is replaced by the new one instead of stacking. Tokens are estimates, because DSH's token meter measures whole messages.

## Failure behavior

Automatic compaction that would not shrink the context is skipped, and it is skipped again until new content arrives. A failed or cancelled summary leaves the context untouched, and a failed session save is reported without recording a false close. Manual compaction with `/compact` always proceeds.

The original events stay in the session log. Compaction replaces the surface the next request is built from, and the log keeps every original message, the summary and the replacement records.

## Settings

There are no user-facing settings for compaction. The trigger ratio and the budget follow Codex's defaults. Cloud compaction with the ChatGPT subscription is a separate feature of provider plugins and is not part of this package.
