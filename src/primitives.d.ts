/**
 * Ambient declarations for the DSH browser module table.
 *
 * The client bundle requires React and the UI primitives at runtime; both
 * ship with the web app, so they are externals of the bundle rather than
 * dependencies here. Only the members this plugin uses are declared, against
 * the 0.2.x contracts.
 */

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ReactNode } from 'react'

  /** The write one field's staged text performs when the card is saved. */
  export type SettingsFieldWrite = { kind: 'set'; value: unknown } | { kind: 'clear' }

  /** How one section field converts between its stored value and its draft text. */
  export interface SettingsFieldSpec {
    field: string
    format: (value: unknown) => string
    parse: (text: string) => SettingsFieldWrite | undefined
  }

  /** One field as a card's control renders it. */
  export interface SettingsFieldState {
    text: string
    overridden: boolean
    invalid: boolean
  }

  /** Form state every plugin card shares. */
  export interface SettingsFormShell {
    available: boolean
    writable: boolean
    dirty: boolean
    invalid: boolean
    saving: boolean
    failed: boolean
  }

  /** The entry form the model stages over. */
  export interface SettingsFormScope<T> {
    getSnapshot(): {
      status: 'loading' | 'ready' | 'unavailable'
      value: T | undefined
      base: unknown
      user: unknown
      writable: boolean
      revision: number | undefined
    }
    subscribe(listener: () => void): () => void
    mutate(
      ops: readonly ({ op: 'set'; path: readonly string[]; value: unknown } | { op: 'unset'; path: readonly string[] })[],
      expectedRevision?: number,
    ): Promise<boolean>
  }

  export interface SettingsFormActions {
    edit: (field: string, text: string) => void
    resetField: (field: string) => void
    save: () => void
    discard: () => void
  }

  /** One card's staged edits over one settings namespace. */
  export class SettingsFormModel<T> {
    constructor(scope: SettingsFormScope<T>, specs: SettingsFieldSpec[])
    bind<S>(project: () => S): { getSnapshot(): S; subscribe(listener: () => void): () => void }
    shell(): SettingsFormShell
    field(field: string): SettingsFieldState
    actions(): SettingsFormActions
    dispose(): void
  }

  /** A whole-number field; an empty draft clears the field. */
  export function settingsNumberField(field: string): SettingsFieldSpec

  export function SettingsForm(props: {
    labels: { unavailable: string; readOnly: string; saveFailed: string; save: string; saving: string }
    state: SettingsFormShell
    onSave: () => void
    onDiscard: () => void
    children?: ReactNode
  }): ReactNode

  export function SettingsValueField(props: {
    id: string
    label: string
    hint?: string
    text: string
    overridden: boolean
    invalid: boolean
    overriddenLabel: string
    resetLabel: string
    invalidLabel: string
    disabled: boolean
    numeric?: boolean
    onEdit: (text: string) => void
    onReset: () => void
  }): ReactNode

  export function SegmentedControl<Value extends string>(props: {
    id: string
    value: Value
    options: readonly { value: Value; label: string; disabled?: boolean; title?: string }[]
    onChange: (next: Value) => void
    label: string
    disabled?: boolean
  }): ReactNode

  /** Localized copy the terminal card needs from its render site. */
  export interface TerminalBlockLabels {
    commandLine: (line: number) => string
    signal: (signal: string) => string
    exitCode: (code: number) => string
    noExitCode: string
    running: string
    failed: string
    done: string
    copy: string
    copied: string
    noOutput: string
    collapseAria: string
    collapse: string
    expandAria: (hidden: number) => string
    expand: (hidden: number) => string
  }

  /** A shell command rendered as a terminal surface, with run-state dot and fold. */
  export function TerminalBlock(props: {
    command: string
    cwd?: string
    home?: string
    output?: string
    exitCode?: number | null
    signal?: string
    running?: boolean
    background?: boolean
    maxLines?: number
    copyText?: string
    runStateDot?: boolean
    className?: string
    labels: TerminalBlockLabels
  }): ReactNode

  /** A small capsule; tone selects the palette. */
  export function Tag(props: {
    tone?: 'outline' | 'solid' | 'neutral' | 'quiet' | 'success' | 'info' | 'warning' | 'danger'
    className?: string
    children?: ReactNode
  }): ReactNode

  /** Shimmer sweep over active (running) copy. */
  export function TextShimmer(props: {
    children?: ReactNode
    active?: boolean
    className?: string
    contentClassName?: string
  }): ReactNode

  /** Icon stroke props shared by the outline icon set. */
  export interface IconProps {
    size?: number
    className?: string
  }

  export interface DiffHunk {
    path: string
    oldText: string | null
    newText: string
  }

  export interface DiffBlockLabels {
    copy: string
    copied: string
    collapseAria: string
    expandAria: (hidden: number) => string
    collapse: string
    expand: (hidden: number) => string
  }

  export function DiffBlock(props: {
    diffs: DiffHunk[]
    labels: DiffBlockLabels
    maxLines?: number
    className?: string
  }): ReactNode

  export function ImagePreview(props: {
    src: string
    alt: string
    loadingLabel: string
    failedLabel: string
  }): ReactNode

  export function IconCodeOutlineRegular(props: IconProps): ReactNode
  export function IconChecklistOutlineRegular(props: IconProps): ReactNode
  export function IconChevronDownOutlineRegular(props: IconProps): ReactNode
  export function IconChevronUpOutlineRegular(props: IconProps): ReactNode
}
