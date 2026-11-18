/**
 * Plugins-page settings card.
 *
 * The card renders on this bundle's own detail page through the
 * `plugins.bundle.config` slot, keyed by the package name. It mounts only
 * while the host serves this entry's settings namespace, so disabling the
 * bundle removes the form instead of leaving fields nothing would accept.
 * Edits are staged until save; the host plugin reads the volatile values on
 * the next request, pre-step or tool sync, so no restart is involved.
 * @module @spectershell/dsh-harness-codex/client-settings
 */
import { createElement as h } from 'react'
import type { ReactNode } from 'react'
import { SegmentedControl, SettingsForm, SettingsFormModel, SettingsValueField, settingsNumberField } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SettingsFieldSpec, SettingsFieldState, SettingsFormScope, SettingsFormShell } from '@deepseek-ai/dsh-client-ui-primitives'

/** The slice of the client slots service this card uses. */
interface SlotsLike {
  inject(key: string, callback: () => () => void): () => void
  register(options: {
    name: string
    key: string
    label: () => string
    locale: string
    inject: () => unknown
  }, factory: (props: CardProps) => unknown): () => void
}

/** The slice of the client config-forms service this card uses. */
interface ConfigFormsLike {
  get<T>(entryId: string): SettingsFormScope<T>
  whileServed(namespaces: readonly string[], register: (served: ReadonlySet<string>) => () => void): () => void
}

/** Context services the settings card needs; all but `effect` are optional. */
export interface SettingsContext {
  effect: (setup: () => (() => void) | void, label: string) => unknown
  slots?: SlotsLike
  configForms?: ConfigFormsLike
}

/** The section value the Host serves for this entry. */
interface CodexSettings {
  freeformEnabled?: boolean
  freeformCodexCatalog?: boolean
  freeformRules?: string
  surfaceAllow?: string
  instructionsMaxBytes?: number
}

/** The props the Plugins page hands a `plugins.bundle.config` entry. */
interface CardProps {
  view?: string
  t: (key: string) => string
  useCodexSettingsCard: <S>(select: (snapshot: CardState) => S) => S
  edit: (field: string, text: string) => void
  resetField: (field: string) => void
  save: () => void
  discard: () => void
}

interface CardState extends SettingsFormShell {
  freeformEnabled: SettingsFieldState
  freeformCodexCatalog: SettingsFieldState
  freeformRules: SettingsFieldState
  surfaceAllow: SettingsFieldState
  instructionsMaxBytes: SettingsFieldState
}

/** A boolean staged as the draft text "on" or "off". */
function booleanField(field: string): SettingsFieldSpec {
  return {
    field,
    format: value => value === true ? 'on' : 'off',
    parse: text => text === 'on'
      ? { kind: 'set', value: true }
      : text === 'off'
        ? { kind: 'set', value: false }
        : undefined,
  }
}

/** Free text, except that an emptied control clears the override. */
function textField(field: string): SettingsFieldSpec {
  return {
    field,
    format: value => typeof value === 'string' ? value : '',
    parse: text => text.trim().length === 0 ? { kind: 'clear' } : { kind: 'set', value: text },
  }
}

/** The whole-number budget field, bounded as the host schema is. */
function instructionsBytesField(): SettingsFieldSpec {
  const numeric = settingsNumberField('instructionsMaxBytes')
  return {
    ...numeric,
    parse: text => {
      const write = numeric.parse(text)
      if (write?.kind !== 'set') return write
      const value = write.value
      return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1024 && value <= 262144
        ? write
        : undefined
    },
  }
}

const SPECS = [
  booleanField('freeformEnabled'),
  booleanField('freeformCodexCatalog'),
  textField('freeformRules'),
  textField('surfaceAllow'),
  instructionsBytesField(),
]

/**
 * The Settings UI identifies bundle-installed entries with an `include:`
 * prefix, while base-composition rows carry their bare id. Watch both forms.
 */
const NAMESPACES = ['@spectershell/dsh-harness-codex', 'include:@spectershell/dsh-harness-codex']

/**
 * The boolean rows repeat the SettingsValueField rhythm (12 px padding,
 * hairline separator, 13 px label, 12 px hint), and the trailing note matches
 * the form's hint metrics. Rendered with the card, the style element leaves
 * with it.
 */
const STYLE = `
.@spectershell/dsh-harness-codex-settings-field { padding: 12px 0; border-top: 0.5px solid var(--dsw-alias-border-l2); }
.@spectershell/dsh-harness-codex-settings-head { display: flex; align-items: center; gap: 8px; }
.@spectershell/dsh-harness-codex-settings-label { flex: 1; min-width: 0; font-size: 13px; font-weight: 500; line-height: 1.5; color: var(--dsw-alias-label-primary); }
.@spectershell/dsh-harness-codex-settings-hint { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.@spectershell/dsh-harness-codex-settings-note { margin: 12px 0 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.@spectershell/dsh-harness-codex-settings-badge { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.@spectershell/dsh-harness-codex-settings-reset { padding: 0; border: 0; background: none; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.@spectershell/dsh-harness-codex-settings-reset:disabled { cursor: default; opacity: 0.5; }
`

const FIELD_CLASS = '@spectershell/dsh-harness-codex-settings-field'
const HEAD_CLASS = '@spectershell/dsh-harness-codex-settings-head'
const LABEL_CLASS = '@spectershell/dsh-harness-codex-settings-label'
const HINT_CLASS = '@spectershell/dsh-harness-codex-settings-hint'

/** A labelled switch rendered as a two-option segmented control. */
function ChoiceField(props: {
  id: string
  label: string
  hint: string
  text: string
  overridden: boolean
  disabled: boolean
  overriddenLabel: string
  resetLabel: string
  onLabel: string
  offLabel: string
  onEdit: (text: string) => void
  onReset: () => void
}): ReactNode {
  const value = props.text === 'on' ? 'on' : 'off'
  return h('div', { key: props.id, className: FIELD_CLASS }, [
    h('div', { key: 'head', className: HEAD_CLASS }, [
      h('span', { key: 'label', className: LABEL_CLASS }, props.label),
      h(SegmentedControl, {
        key: 'control',
        id: props.id,
        value,
        options: [
          { value: 'off' as const, label: props.offLabel },
          { value: 'on' as const, label: props.onLabel },
        ],
        label: props.label,
        disabled: props.disabled,
        onChange: (next: string) => props.onEdit(next),
      }),
      props.overridden ? h('span', { key: 'badge', className: '@spectershell/dsh-harness-codex-settings-badge' }, props.overriddenLabel) : null,
      props.overridden
        ? h('button', {
          key: 'reset',
          type: 'button',
          className: '@spectershell/dsh-harness-codex-settings-reset',
          disabled: props.disabled,
          onClick: props.onReset,
        }, props.resetLabel)
        : null,
    ]),
    h('p', { key: 'hint', className: HINT_CLASS }, props.hint),
  ])
}

/** The card component the Plugins page renders on the bundle detail page. */
function CodexSettingsCard(props: CardProps): ReactNode {
  const { t } = props
  const state = props.useCodexSettingsCard(snapshot => snapshot)
  const disabled = !state.writable
  return h(SettingsForm, {
    labels: {
      unavailable: t('settings.unavailable'),
      readOnly: t('settings.readOnly'),
      saveFailed: t('settings.saveFailed'),
      save: t('settings.save'),
      saving: t('settings.saving'),
    },
    state,
    onSave: props.save,
    onDiscard: props.discard,
  }, [
    h('style', { key: 'style' }, STYLE),
    h(ChoiceField, {
      key: 'freeformEnabled',
      id: '@spectershell/dsh-harness-codex-freeformEnabled',
      label: t('settings.freeformEnabled'),
      hint: t('settings.freeformEnabledHint'),
      text: state.freeformEnabled.text,
      overridden: state.freeformEnabled.overridden,
      disabled: disabled || state.saving,
      overriddenLabel: t('settings.overridden'),
      resetLabel: t('settings.reset'),
      onLabel: t('settings.on'),
      offLabel: t('settings.off'),
      onEdit: text => props.edit('freeformEnabled', text),
      onReset: () => props.resetField('freeformEnabled'),
    }),
    h(ChoiceField, {
      key: 'freeformCodexCatalog',
      id: '@spectershell/dsh-harness-codex-freeformCodexCatalog',
      label: t('settings.freeformCodexCatalog'),
      hint: t('settings.freeformCodexCatalogHint'),
      text: state.freeformCodexCatalog.text,
      overridden: state.freeformCodexCatalog.overridden,
      disabled: disabled || state.saving,
      overriddenLabel: t('settings.overridden'),
      resetLabel: t('settings.reset'),
      onLabel: t('settings.on'),
      offLabel: t('settings.off'),
      onEdit: text => props.edit('freeformCodexCatalog', text),
      onReset: () => props.resetField('freeformCodexCatalog'),
    }),
    h(SettingsValueField, {
      key: 'freeformRules',
      id: '@spectershell/dsh-harness-codex-freeformRules',
      label: t('settings.freeformRules'),
      hint: t('settings.freeformRulesHint'),
      ...state.freeformRules,
      overriddenLabel: t('settings.overridden'),
      resetLabel: t('settings.reset'),
      invalidLabel: t('settings.invalidText'),
      disabled: disabled || state.saving,
      onEdit: (text: string) => props.edit('freeformRules', text),
      onReset: () => props.resetField('freeformRules'),
    }),
    h(SettingsValueField, {
      key: 'surfaceAllow',
      id: '@spectershell/dsh-harness-codex-surfaceAllow',
      label: t('settings.surfaceAllow'),
      hint: t('settings.surfaceAllowHint'),
      ...state.surfaceAllow,
      overriddenLabel: t('settings.overridden'),
      resetLabel: t('settings.reset'),
      invalidLabel: t('settings.invalidText'),
      disabled: disabled || state.saving,
      onEdit: (text: string) => props.edit('surfaceAllow', text),
      onReset: () => props.resetField('surfaceAllow'),
    }),
    h(SettingsValueField, {
      key: 'instructionsMaxBytes',
      id: '@spectershell/dsh-harness-codex-instructionsMaxBytes',
      label: t('settings.instructionsMaxBytes'),
      hint: t('settings.instructionsMaxBytesHint'),
      numeric: true,
      ...state.instructionsMaxBytes,
      overriddenLabel: t('settings.overridden'),
      resetLabel: t('settings.reset'),
      invalidLabel: t('settings.invalidNumber'),
      disabled: disabled || state.saving,
      onEdit: (text: string) => props.edit('instructionsMaxBytes', text),
      onReset: () => props.resetField('instructionsMaxBytes'),
    }),
    h('p', { key: 'reload', className: '@spectershell/dsh-harness-codex-settings-note' }, t('settings.reload')),
  ])
}

/**
 * Mount the settings card while the host serves the settings namespace.
 * No-op for direct API callers, whose context has no slots or configForms.
 * @param ctx - the client plugin context.
 * @param translate - translator bound to this bundle's locale namespace.
 */
export function mountSettingsCard(ctx: SettingsContext, translate: (key: string) => string): void {
  if (!ctx.slots || !ctx.configForms) return
  const slots = ctx.slots
  const configForms = ctx.configForms
  ctx.effect(() => configForms.whileServed(NAMESPACES, served => {
    // The served set tells us which id form this profile composed.
    const namespace = NAMESPACES.find(name => served.has(name)) ?? NAMESPACES[0]
    const form = new SettingsFormModel<CodexSettings>(configForms.get(namespace), SPECS)
    const store = form.bind((): CardState => ({
      ...form.shell(),
      freeformEnabled: form.field('freeformEnabled'),
      freeformCodexCatalog: form.field('freeformCodexCatalog'),
      freeformRules: form.field('freeformRules'),
      surfaceAllow: form.field('surfaceAllow'),
      instructionsMaxBytes: form.field('instructionsMaxBytes'),
    }))
    const disposeSlot = slots.inject('plugins.bundle.config', () => slots.register({
      name: 'plugins.bundle.config',
      // The page renders this entry on the detail page of the package whose
      // name matches the key.
      key: '@spectershell/dsh-harness-codex',
      label: () => translate('settings.title'),
      locale: '@spectershell/dsh-harness-codex',
      inject: () => ({ hooks: { codexSettingsCard: store }, ...form.actions() }),
    }, CodexSettingsCard))
    return () => {
      disposeSlot()
      form.dispose()
    }
  }), '@spectershell/dsh-harness-codex: settings card')
}
