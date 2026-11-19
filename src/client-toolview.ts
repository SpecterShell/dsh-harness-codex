/**
 * Conversation rows for the Codex exec tools.
 *
 * `exec_command` and `write_stdin` reply with Codex's text envelope
 * (`Wall time: …`, `Process exited with code N` or `Process running with
 * session ID n`, then `Output:` and the body), which the generic tool row can
 * only show as raw text. These rows mirror the built-in Bash card: a
 * collapsible header with the command summary and an exit-code badge, and an
 * expanded TerminalBlock whose state dot reads green on a clean exit, red on
 * a failure, and keeps chasing while the process runs.
 * @module @spectershell/dsh-harness-codex/client-toolview
 */
import { createElement as h, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DiffBlock, IconChecklistOutlineRegular, IconChevronDownOutlineRegular, IconChevronUpOutlineRegular, IconCodeOutlineRegular, ImagePreview, Tag, TerminalBlock, TextShimmer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { DiffBlockLabels, DiffHunk, TerminalBlockLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import { isRecord } from './guards.ts'

/** The locale namespace the client entry registers these dictionaries under. */
const NS = '@spectershell/dsh-harness-codex'

/** Row translator; the slot runtime binds it to the entry's locale namespace. */
type Translate = (key: string, params?: Record<string, string | number>) => string

/** Streamed-argument accessor the Tool blocks expose to row models. */
interface ArgsAccessor {
  has: (key: string) => boolean
  complete: (key: string) => boolean
  text: (key: string) => string | undefined
}

/** A call still streaming its arguments or waiting on the tool. */
interface StreamingBlock {
  phase: 'preparing' | 'start'
  callId: string
  name: string
  args: ArgsAccessor
  argsRaw: string
}

/** A settled call and its result content. */
interface ResultBlock {
  kind: string
  callId: string
  call: { name: string, argsRaw: string } | null
  args: ArgsAccessor
  content: readonly unknown[]
  isError: boolean
  error?: { code?: string }
  meta?: unknown
  parentCallId?: string
}

type ToolBlock = StreamingBlock | ResultBlock

/** The props the `tool.call.toolview` slot hands every keyed entry. */
interface AttachmentRef {
  attachmentId: string
  mediaType: string
  bytes: number
  width: number
  height: number
  name?: string
}

interface ImageLoader {
  (attachment: AttachmentRef): Promise<string>
  peek?: (attachment: AttachmentRef) => string | null
}

interface ToolviewProps {
  toolName: string
  block: ToolBlock
  cwd?: string
  home?: string
  loadImage?: ImageLoader
  useDisclosure: () => { expanded: boolean, toggle: () => void }
  t: Translate
}

/** The slice of the client slots service these rows register through. */
interface SlotsLike {
  inject: (key: string, callback: () => Iterable<() => void>) => () => void
  register: (options: {
    name: string
    key: string
    locale: string
    priority?: number
  }, factory: (props: ToolviewProps) => ReactNode) => () => void
}

/** Context services the toolview registration needs. */
export interface ToolviewContext {
  effect: (setup: () => (() => void) | void, label: string) => unknown
  slots?: SlotsLike
}

/** Codex's settled-process marker (`ExecCommandToolOutput::response_text`). */
const EXIT_PATTERN = /^Process exited with code (-?\d+)$/m
/** Codex's still-running marker; the session id feeds later write_stdin calls. */
const SESSION_PATTERN = /^Process running with session ID (\d+)$/m
/** The header/body separator Codex always ends the header with. */
const OUTPUT_PATTERN = /\nOutput:\n/

/** The first line of a possibly multi-line text. */
function firstLine(text: string): string {
  const end = text.indexOf('\n')
  return end < 0 ? text : text.slice(0, end)
}

/**
 * Read the exact single text block of a settled result.
 * @param block - settled Tool result.
 * @returns its text, or undefined for any other content layout.
 */
function singleResultText(block: ResultBlock): string | undefined {
  if (block.content.length !== 1) return undefined
  const only = block.content[0]
  return isRecord(only) && only.type === 'text' && typeof only.text === 'string' ? only.text : undefined
}

/** The parsed Codex process status: exit code or live session, plus the body. */
interface ProcessStatus {
  output: string
  exitCode?: number
  sessionId?: string
}

/**
 * Parse Codex's reply envelope without importing the Host's exec plugin.
 * @param text - the raw result text.
 * @returns the output body and any status the header carried.
 */
function parseProcessStatus(text: string): ProcessStatus {
  const exit = EXIT_PATTERN.exec(text)
  const session = SESSION_PATTERN.exec(text)
  const marker = OUTPUT_PATTERN.exec(text)
  const output = marker === null ? text : text.slice(marker.index + marker[0].length)
  return {
    output,
    ...exit?.[1] !== undefined ? { exitCode: Number(exit[1]) } : {},
    ...session?.[1] !== undefined ? { sessionId: session[1] } : {},
  }
}

/** Presentation states, matching the built-in row's vocabulary. */
type ExecState = 'preparing' | 'running' | 'ok' | 'error' | 'stopped'

/** Everything the row renders, derived once per block. */
interface ExecModel {
  state: ExecState
  /** The terminal prompt text: the command, or the stdin bytes sent. */
  command: string
  /** True when the tool settled but the process outlived the wait. */
  processRunning: boolean
  output?: string
  exitCode?: number
  /** The collapsed row's one-line summary. */
  summary: string
}

/**
 * Read the chars a write_stdin call sent; an empty write is a poll.
 * @param args - the call's streamed arguments.
 * @returns the raw bytes, or undefined when they have not streamed yet.
 */
function stdinChars(args: ArgsAccessor): string | undefined {
  return args.has('chars') ? args.text('chars') ?? '' : undefined
}

/**
 * Derive the row model from a frozen call slice.
 *
 * The tool settles a failing command as a completed call (`isError` stays
 * false: the exit status is result data), exactly like the built-in bash
 * tool, so a non-zero exit code turns the row red without the tool failing.
 * @param toolName - wire tool name (`exec_command` or `write_stdin`).
 * @param block - preparing call, dispatched call, or result from the snapshot.
 * @param pollLabel - localized label for a write_stdin poll.
 * @returns the row model.
 */
function execModel(toolName: string, block: ToolBlock, pollLabel: string): ExecModel {
  const raw = toolName === 'write_stdin' ? stdinChars(block.args) : block.args.text('cmd')
  const command = raw ?? ''
  const base = {
    command,
    summary: command === '' && toolName === 'write_stdin' ? pollLabel : firstLine(command),
  }
  if (!('kind' in block)) {
    return {
      ...base,
      state: block.phase === 'preparing' ? 'preparing' : 'running',
      processRunning: true,
    }
  }
  if (block.error?.code === 'interrupted') {
    return { ...base, state: 'stopped', processRunning: false }
  }
  if (block.isError) {
    const output = singleResultText(block)
    return {
      ...base,
      state: 'error',
      processRunning: false,
      ...output !== undefined ? { output, summary: firstLine(output) } : {},
    }
  }
  const text = singleResultText(block)
  if (text === undefined) {
    return { ...base, state: 'ok', processRunning: false }
  }
  const status = parseProcessStatus(text)
  if (status.exitCode !== undefined) {
    return {
      ...base,
      state: status.exitCode === 0 ? 'ok' : 'error',
      processRunning: false,
      output: status.output,
      exitCode: status.exitCode,
    }
  }
  return {
    ...base,
    state: 'ok',
    processRunning: status.sessionId !== undefined,
    output: status.output,
  }
}

/** Build the TerminalBlock copy from the row translator. */
function terminalLabels(t: Translate): TerminalBlockLabels {
  return {
    commandLine: line => t('toolview.commandLine', { n: line }),
    signal: signal => t('toolview.signal', { signal }),
    exitCode: code => t('toolview.exitCode', { code }),
    noExitCode: t('toolview.noExitCode'),
    running: t('toolview.running'),
    failed: t('toolview.failed'),
    done: t('toolview.done'),
    copy: t('toolview.copy'),
    copied: t('toolview.copied'),
    noOutput: t('toolview.noOutput'),
    collapseAria: t('toolview.collapseAria'),
    collapse: t('toolview.collapse'),
    expandAria: hidden => t('toolview.expandAria', { n: hidden }),
    expand: hidden => t('toolview.expand', { n: hidden }),
  }
}

/** Visually hidden status for the color-only running sweep and error tone. */
function stateStatus(state: ExecState, t: Translate): string | null {
  switch (state) {
    case 'preparing': return t('toolview.preparing')
    case 'running': return t('toolview.running')
    case 'error': return t('toolview.failed')
    case 'stopped': return t('toolview.stopped')
    default: return null
  }
}

const EXEC_ICON = h(IconCodeOutlineRegular, { size: 14 })

/** Inline exit status for a settled command, after the built-in badge. */
function ExitCodeBadge(props: { label: string }): ReactNode {
  return h(Tag, { tone: 'neutral', className: 'dsh-harness-codex-exec-badge' }, [
    h('span', { key: 'dot', className: 'dsh-harness-codex-exec-badge-dot', 'aria-hidden': true }),
    props.label,
  ])
}

/**
 * Render expandable exec output with an accessible lifecycle label.
 *
 * The layout follows the built-in BashRow: a one-line header that expands
 * into the terminal card, or into the input/output card when the tool itself
 * failed and no process status exists to frame.
 * @param props - tool call, Session sources, and locale from the slot runtime.
 * @returns the exec output row.
 */
function ExecRow(props: ToolviewProps): ReactNode {
  const { toolName, block, cwd, home, useDisclosure, t } = props
  const model = useMemo(() => execModel(toolName, block, t('toolview.poll')), [toolName, block, t])
  const labels = useMemo(() => terminalLabels(t), [t])
  const state = model.state
  const status = stateStatus(state, t)
  const { expanded, toggle } = useDisclosure()
  const failed = state === 'error'
  const stopped = state === 'stopped'
  const running = state === 'running' || state === 'preparing'
  const terminal = !('kind' in block) || !block.isError
  const expandable = model.command !== '' || model.output !== undefined
  const open = expanded && expandable
  const exitLabel = model.exitCode !== undefined && model.exitCode !== 0
    ? t('toolview.exitCode', { code: model.exitCode })
    : null
  const leading = open
    ? h(IconChevronUpOutlineRegular, { className: 'dsh-harness-codex-exec-chevron' })
    : expandable
      ? h('span', { key: 'icons', className: 'dsh-harness-codex-exec-leading-icons' }, [
        h('span', { key: 'icon', className: 'dsh-harness-codex-exec-icon-idle' }, EXEC_ICON),
        h(IconChevronDownOutlineRegular, { key: 'chevron', className: 'dsh-harness-codex-exec-chevron dsh-harness-codex-exec-chevron-hover' }),
      ])
      : EXEC_ICON
  const body = terminal
    ? h(TerminalBlock, {
      command: model.command === '' ? t('toolview.poll') : model.command,
      ...cwd !== undefined ? { cwd } : {},
      ...home !== undefined ? { home } : {},
      ...model.output !== undefined ? { output: model.output } : {},
      ...model.exitCode !== undefined ? { exitCode: model.exitCode } : {},
      running: model.processRunning,
      maxLines: Infinity,
      labels,
      className: 'dsh-harness-codex-exec-terminal',
    })
    : h('div', { className: 'dsh-harness-codex-exec-io-card' }, [
      model.command !== ''
        ? h('div', { key: 'input', className: 'dsh-harness-codex-exec-io-section' }, [
          h('span', { key: 'label', className: 'dsh-harness-codex-exec-io-label' }, t('toolview.input')),
          h('span', { key: 'text', className: 'dsh-harness-codex-exec-io-text' }, model.command),
        ])
        : null,
      model.command !== '' && model.output !== undefined
        ? h('span', { key: 'divider', className: 'dsh-harness-codex-exec-io-divider', 'aria-hidden': true })
        : null,
      model.output !== undefined
        ? h('div', { key: 'output', className: 'dsh-harness-codex-exec-io-section' }, [
          h('span', { key: 'label', className: 'dsh-harness-codex-exec-io-label' }, t('toolview.output')),
          h('span', { key: 'text', className: 'dsh-harness-codex-exec-io-text', ...failed ? { 'data-error': true } : {} }, model.output),
        ])
        : null,
    ])
  return h('div', { className: 'dsh-harness-codex-exec-card' }, [
    h('div', {
      key: 'root',
      className: 'dsh-harness-codex-exec-root',
      'data-tool': toolName,
      'data-state': state,
      ...expandable ? { 'data-expandable': true } : {},
      ...expandable ? { role: 'button', tabIndex: 0, 'aria-expanded': open } : {},
      ...expandable ? {
        onClick: toggle,
        onKeyDown: (event: { key: string, preventDefault: () => void }) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          toggle()
        },
      } : {},
    }, [
      h('span', { key: 'leading', className: 'dsh-harness-codex-exec-leading' }, leading),
      status !== null ? h('span', { key: 'status', className: 'dsh-harness-codex-exec-visually-hidden' }, status) : null,
      h(TextShimmer, { key: 'head', active: running, className: 'dsh-harness-codex-exec-head' }, [
        h('span', { key: 'title', className: 'dsh-harness-codex-exec-title' }, toolName),
        model.summary !== ''
          ? h('span', { key: 'sep', className: 'dsh-harness-codex-exec-sep', 'aria-hidden': true })
          : null,
        model.summary !== ''
          ? h('span', {
            key: 'summary',
            className: `dsh-harness-codex-exec-summary${failed && exitLabel === null ? ' dsh-harness-codex-exec-summary-error' : ''}${stopped ? ' dsh-harness-codex-exec-summary-stopped' : ''}`,
          }, model.summary)
          : null,
      ]),
      model.processRunning && !running
        ? h(Tag, { key: 'session', tone: 'info', className: 'dsh-harness-codex-exec-badge' }, labels.running)
        : null,
      exitLabel !== null ? h(ExitCodeBadge, { key: 'exit', label: exitLabel }) : null,
    ]),
    open ? h('div', { key: 'body', className: 'dsh-harness-codex-exec-body' }, body) : null,
  ])
}

/** A compact expandable row shared by the Codex-only cards. */
function CardRow(props: {
  icon: ReactNode
  title: string
  summary: string
  badge?: ReactNode
  body?: ReactNode
  useDisclosure: ToolviewProps['useDisclosure']
}): ReactNode {
  const { expanded, toggle } = props.useDisclosure()
  const open = expanded && props.body !== undefined
  return h('div', { className: 'dsh-harness-codex-card' }, [
    h('div', {
      key: 'head',
      className: 'dsh-harness-codex-card-head',
      ...(props.body !== undefined ? {
        role: 'button', tabIndex: 0, 'aria-expanded': open, onClick: toggle,
        onKeyDown: (event: { key: string, preventDefault: () => void }) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          toggle()
        },
      } : {}),
    }, [
      h('span', { key: 'icon', className: 'dsh-harness-codex-card-icon' }, open ? h(IconChevronUpOutlineRegular, {}) : props.icon),
      h('span', { key: 'title', className: 'dsh-harness-codex-card-title' }, props.title),
      props.summary === '' ? null : h('span', { key: 'summary', className: 'dsh-harness-codex-card-summary' }, props.summary),
      props.badge ?? null,
    ]),
    open ? h('div', { key: 'body', className: 'dsh-harness-codex-card-body' }, props.body) : null,
  ])
}

interface PlanItem { step: string, status: 'pending' | 'in_progress' | 'completed' }

/** Parse the `plan` argument from the raw call arguments, as the built-in todo card does. */
function planItems(block: ToolBlock): PlanItem[] {
  const raw = 'argsRaw' in block ? block.argsRaw : block.call?.argsRaw
  if (raw === undefined) return []
  try {
    const outer: unknown = JSON.parse(raw)
    const value: unknown = isRecord(outer) ? outer.plan : undefined
    if (!Array.isArray(value)) return []
    return value.flatMap(item => isRecord(item)
      && typeof item.step === 'string'
      && (item.status === 'pending' || item.status === 'in_progress' || item.status === 'completed')
      ? [{ step: item.step, status: item.status }]
      : [])
  } catch {
    return []
  }
}

/** Render a Codex update_plan call from its own arguments. */
function PlanRow({ block, useDisclosure, t }: ToolviewProps): ReactNode {
  const plan = planItems(block)
  const done = plan.filter(item => item.status === 'completed').length
  const active = plan.find(item => item.status === 'in_progress')?.step
  const summary = `${t('toolview.plan.done', { done, total: plan.length })}${active === undefined ? '' : ` · ${active}`}`
  const body = plan.length === 0 ? undefined : h('ol', { className: 'dsh-harness-codex-plan' }, plan.map((item, index) =>
    h('li', { key: `${index}:${item.step}`, className: 'dsh-harness-codex-plan-item', 'data-status': item.status }, [
      h('span', { key: 'mark', className: 'dsh-harness-codex-plan-mark', 'aria-hidden': true }),
      h('span', { key: 'step', className: 'dsh-harness-codex-plan-step' }, item.step),
      h(Tag, { key: 'status', tone: item.status === 'completed' ? 'success' : item.status === 'in_progress' ? 'info' : 'quiet' }, t(`toolview.plan.${item.status === 'in_progress' ? 'inProgress' : item.status}`)),
    ])))
  return h(CardRow, { icon: h(IconChecklistOutlineRegular, {}), title: 'update_plan', summary, body, useDisclosure })
}

/** Locate the durable image reference emitted in the settled result content. */
function resultImage(block: ToolBlock): AttachmentRef | undefined {
  if (!('kind' in block) || block.isError) return undefined
  for (const part of block.content) {
    if (!isRecord(part) || part.type !== 'image' || !isRecord(part.attachment)) continue
    const ref = part.attachment
    if (typeof ref.attachmentId === 'string' && typeof ref.mediaType === 'string'
      && typeof ref.bytes === 'number' && typeof ref.width === 'number' && typeof ref.height === 'number') {
      return { attachmentId: ref.attachmentId, mediaType: ref.mediaType, bytes: ref.bytes, width: ref.width, height: ref.height, ...(typeof ref.name === 'string' ? { name: ref.name } : {}) }
    }
  }
}

/** Preview one attachment through the same loader supplied to built-in toolviews. */
function LoadedImage({ attachment, loadImage, t }: { attachment: AttachmentRef, loadImage: ImageLoader, t: Translate }): ReactNode {
  const [src, setSrc] = useState<string | null>(() => loadImage.peek?.(attachment) ?? null)
  useEffect(() => {
    let live = true
    loadImage(attachment).then(value => { if (live) setSrc(value) }).catch(() => { if (live) setSrc('') })
    return () => { live = false }
  }, [attachment, loadImage])
  return src === null
    ? h('div', { className: 'dsh-harness-codex-image-loading' }, t('toolview.image.loading'))
    : h(ImagePreview, { src, alt: attachment.name ?? t('toolview.image.alt'), loadingLabel: t('toolview.image.loading'), failedLabel: t('toolview.image.failed') })
}

declare const navigator: { clipboard?: { writeText: (text: string) => Promise<void> } } | undefined

/** Small path copy action, kept inside the expanded image metadata. */
function CopyPath({ path, t }: { path: string, t: Translate }): ReactNode {
  const [copied, setCopied] = useState(false)
  return h('button', {
    type: 'button',
    className: 'dsh-harness-codex-image-copy',
    onClick: (event: { stopPropagation: () => void }) => {
      event.stopPropagation()
      if (typeof navigator === 'undefined' || navigator.clipboard === undefined) return
      navigator.clipboard.writeText(path).then(() => setCopied(true)).catch(() => {})
    },
  }, copied ? t('toolview.copied') : t('toolview.copy'))
}

/** Render view_image with the attachment loader already carried by ToolCallTree. */
function ViewImageRow({ block, loadImage, useDisclosure, t }: ToolviewProps): ReactNode {
  const attachment = resultImage(block)
  const path = block.args.text('path') ?? ''
  const summary = attachment === undefined ? path : `${path} · ${attachment.width}×${attachment.height} · ${attachment.bytes} B`
  const body = attachment !== undefined && loadImage !== undefined
    ? h('div', { className: 'dsh-harness-codex-image' }, [
      h(LoadedImage, { key: 'preview', attachment, loadImage, t }),
      h('div', { key: 'pathrow', className: 'dsh-harness-codex-image-path-row' }, [
        h('div', { key: 'path', className: 'dsh-harness-codex-image-path' }, path),
        h(CopyPath, { key: 'copy', path, t }),
      ]),
      h('div', { key: 'meta', className: 'dsh-harness-codex-image-meta' }, `${attachment.width}×${attachment.height} · ${attachment.bytes} B`),
    ])
    : undefined
  return h(CardRow, { icon: h(IconCodeOutlineRegular, { size: 14 }), title: 'view_image', summary, body, useDisclosure })
}

/** Narrow apply_patch presentation metadata to the DiffBlock contract. */
function resultDiffs(block: ToolBlock): DiffHunk[] {
  if (!('kind' in block) || block.isError || !isRecord(block.meta) || !Array.isArray(block.meta.diffs)) return []
  return block.meta.diffs.flatMap(diff => isRecord(diff)
    && typeof diff.path === 'string'
    && (diff.oldText === null || typeof diff.oldText === 'string')
    && typeof diff.newText === 'string'
    ? [{ path: diff.path, oldText: diff.oldText, newText: diff.newText }]
    : [])
}

function diffLabels(t: Translate): DiffBlockLabels {
  return {
    copy: t('toolview.copy'), copied: t('toolview.copied'), collapseAria: t('toolview.collapseAria'),
    expandAria: hidden => t('toolview.expandAria', { n: hidden }), collapse: t('toolview.collapse'),
    expand: hidden => t('toolview.expand', { n: hidden }),
  }
}

/** Shadow the built-in apply_patch key so free-form calls can carry a badge. */
function ApplyPatchRow({ block, useDisclosure, t }: ToolviewProps): ReactNode {
  const diffs = resultDiffs(block)
  const badge = block.callId.includes('|ctc_')
    ? h(Tag, { tone: 'quiet', className: 'dsh-harness-codex-freeform' }, t('toolview.freeForm'))
    : undefined
  const body = diffs.length === 0 ? undefined : h(DiffBlock, { diffs, labels: diffLabels(t), maxLines: 9 })
  return h(CardRow, { icon: h(IconCodeOutlineRegular, { size: 14 }), title: 'apply_patch', summary: '', badge, body, useDisclosure })
}

/**
 * The row chrome, adapted from the built-in BashRow sheet with the interactive
 * bits (inspect button, background-command styling) these rows do not use
 * removed. Injected once into the document head, like the built-in sheets.
 */
const STYLE = `
.dsh-harness-codex-exec-card { display: flex; flex-direction: column; }
.dsh-harness-codex-exec-terminal { --dsl-terminal-font: var(--dsw-font-markdown-code-block-small); --dsl-terminal-line-height: 18px; --dsl-terminal-output-max-height: 224px; --dsl-terminal-command-whitespace: pre-wrap; border: 0.5px solid var(--dsw-alias-border-l1); margin: 4px 0 4px 4px; }
.dsh-harness-codex-exec-io-card { display: flex; flex-direction: column; margin: 4px 0 4px 4px; border: 0.5px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-markdown-code-block); font: var(--dsw-font-markdown-code-block-small); }
.dsh-harness-codex-exec-io-section { display: grid; grid-template-columns: max-content 1fr; align-items: baseline; column-gap: 14px; max-height: 150px; padding: 12px 16px; overflow-y: auto; }
.dsh-harness-codex-exec-io-label { align-self: start; position: sticky; top: 0; color: var(--dsw-alias-label-caption); }
.dsh-harness-codex-exec-io-divider { flex: none; height: 0.5px; background: var(--dsw-alias-border-l2); }
.dsh-harness-codex-exec-io-text { min-width: 0; white-space: pre-wrap; word-break: break-word; color: var(--dsw-alias-label-secondary); }
.dsh-harness-codex-exec-io-text[data-error] { color: var(--dsw-alias-state-error-primary); }
.dsh-harness-codex-exec-root { display: flex; align-items: center; min-width: 0; height: calc(24px + var(--dsh-content-font-delta, 0px)); color: var(--dsw-alias-label-tertiary); transition: color 0.1s; }
.dsh-harness-codex-exec-root[data-expandable] { cursor: pointer; }
@media (hover: hover) { .dsh-harness-codex-exec-root:hover { color: var(--dsw-alias-label-secondary); } }
@media (prefers-reduced-motion: reduce) { .dsh-harness-codex-exec-root { transition: none; } }
.dsh-harness-codex-exec-leading { position: relative; display: inline-flex; flex: none; align-items: center; justify-content: center; width: calc(16px + var(--dsh-content-font-delta, 0px)); height: calc(16px + var(--dsh-content-font-delta, 0px)); margin-right: 6px; color: inherit; }
.dsh-harness-codex-exec-leading svg:not([data-state]) { width: calc(14px + var(--dsh-content-font-delta, 0px)); height: calc(14px + var(--dsh-content-font-delta, 0px)); }
.dsh-harness-codex-exec-leading-icons { display: inline-flex; }
.dsh-harness-codex-exec-icon-idle { display: inline-flex; opacity: 1; transition: opacity 0.1s; }
.dsh-harness-codex-exec-chevron { color: inherit; }
.dsh-harness-codex-exec-chevron-hover { position: absolute; inset: 0; margin: auto; opacity: 0; transition: opacity 0.1s; }
@media (hover: hover) { .dsh-harness-codex-exec-root:hover .dsh-harness-codex-exec-icon-idle { opacity: 0; } .dsh-harness-codex-exec-root:hover .dsh-harness-codex-exec-chevron-hover { opacity: 1; } }
.dsh-harness-codex-exec-head { display: inline-flex; align-items: center; min-width: 0; }
.dsh-harness-codex-exec-title { flex: none; font-size: var(--dsh-content-font-size-secondary, 13px); line-height: calc(24px + var(--dsh-content-font-delta, 0px)); }
.dsh-harness-codex-exec-sep { flex: none; width: 2px; height: 2px; margin: 0 8px; border-radius: 1px; background: var(--dsw-alias-label-caption); }
.dsh-harness-codex-exec-summary { flex: auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--dsh-content-font-size-secondary, 13px); line-height: calc(24px + var(--dsh-content-font-delta, 0px)); }
.dsh-harness-codex-exec-summary-error { color: var(--dsw-alias-state-error-primary); }
.dsh-harness-codex-exec-summary-stopped { color: var(--dsw-alias-state-warn-label); }
.dsh-harness-codex-exec-badge { flex: none; gap: 5px; margin-left: 8px; }
.dsh-harness-codex-exec-badge-dot { flex: none; width: 4px; height: 4px; border-radius: 50%; corner-shape: round; background: var(--dsw-alias-state-error-primary); }
.dsh-harness-codex-exec-body { display: flex; flex-direction: column; }
.dsh-harness-codex-exec-visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.dsh-harness-codex-card { display: flex; flex-direction: column; }
.dsh-harness-codex-card-head { display: flex; align-items: center; min-width: 0; min-height: 24px; color: var(--dsw-alias-label-tertiary); }
.dsh-harness-codex-card-head[role=button] { cursor: pointer; }
.dsh-harness-codex-card-icon { display: inline-flex; align-items: center; justify-content: center; width: 16px; margin-right: 6px; }
.dsh-harness-codex-card-title { flex: none; font-size: var(--dsh-content-font-size-secondary, 13px); }
.dsh-harness-codex-card-summary { min-width: 0; margin-left: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsw-alias-label-secondary); font-size: var(--dsh-content-font-size-secondary, 13px); }
.dsh-harness-codex-card-body { margin: 4px 0 4px 22px; }
.dsh-harness-codex-plan { display: flex; flex-direction: column; gap: 7px; margin: 0; padding: 10px 12px; list-style: none; border: 0.5px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-lg); }
.dsh-harness-codex-plan-item { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsh-harness-codex-plan-mark { width: 6px; height: 6px; flex: none; border-radius: 50%; background: var(--dsw-alias-label-caption); }
.dsh-harness-codex-plan-item[data-status=completed] .dsh-harness-codex-plan-mark { background: var(--dsw-alias-state-success-primary); }
.dsh-harness-codex-plan-item[data-status=in_progress] .dsh-harness-codex-plan-mark { background: var(--dsw-alias-state-info-primary); }
.dsh-harness-codex-plan-step { flex: 1; min-width: 0; color: var(--dsw-alias-label-secondary); }
.dsh-harness-codex-image { display: flex; max-width: 360px; flex-direction: column; gap: 6px; }
.dsh-harness-codex-image-path-row { display: flex; align-items: center; gap: 8px; }
.dsh-harness-codex-image-path { min-width: 0; flex: 1; }
.dsh-harness-codex-image-path, .dsh-harness-codex-image-meta, .dsh-harness-codex-image-loading { color: var(--dsw-alias-label-secondary); font-size: var(--dsh-content-font-size-secondary, 13px); overflow-wrap: anywhere; }
.dsh-harness-codex-image-copy { flex: none; border: 0; padding: 2px 6px; border-radius: var(--dsw-radius-sm); color: var(--dsw-alias-label-secondary); background: transparent; cursor: pointer; }
.dsh-harness-codex-freeform { flex: none; margin-left: 8px; }
`

const STYLE_TAG_ID = '@spectershell/dsh-harness-codex/exec-toolview.css'

/**
 * The browser document, declared structurally because the typecheck runs
 * without the DOM library (the client entry is checked against the browser
 * module table's contracts, not lib.dom).
 */
declare const document: {
  querySelector: (selector: string) => unknown
  createElement: (tag: string) => { dataset: Record<string, string | undefined>, textContent: string | null }
  head: { appendChild: (node: unknown) => unknown }
} | undefined

/** Install the sheet once; shared by every mounted row. */
function injectStyle(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG_ID)}]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = NS
  tag.dataset.pluginCss = STYLE_TAG_ID
  tag.textContent = STYLE
  document.head.appendChild(tag)
}

/**
 * Register the exec rows on the `tool.call.toolview` slot.
 * No-op for direct API callers, whose context has no slots.
 * @param ctx - the client plugin context.
 */
export function apply(ctx: ToolviewContext): void {
  if (!ctx.slots) return
  const slots = ctx.slots
  injectStyle()
  ctx.effect(() => slots.inject('tool.call.toolview', function* () {
    yield slots.register({ name: 'tool.call.toolview', key: 'exec_command', locale: NS }, ExecRow)
    yield slots.register({ name: 'tool.call.toolview', key: 'write_stdin', locale: NS }, ExecRow)
    yield slots.register({ name: 'tool.call.toolview', key: 'update_plan', locale: NS }, PlanRow)
    yield slots.register({ name: 'tool.call.toolview', key: 'view_image', locale: NS }, ViewImageRow)
    // Keyed entries at the same priority collide. A lower priority shadows the
    // built-in registration because keyed dispatch renders the lowest entry.
    yield slots.register({ name: 'tool.call.toolview', key: 'apply_patch', locale: NS, priority: -1 }, ApplyPatchRow)
  }), '@spectershell/dsh-harness-codex: exec toolviews')
}
