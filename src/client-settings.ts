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
import { createElement as h, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { SegmentedControl, SettingsForm, SettingsFormModel, SettingsValueField, settingsNumberField } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SettingsFieldSpec, SettingsFieldState, SettingsFormScope, SettingsFormShell } from '@deepseek-ai/dsh-client-ui-primitives'
import { addRule, formatRuleList, parseRuleEntry, parseRuleList, removeRuleAt } from './config.ts'
import type { RuleText } from './config.ts'
import { isRecord } from './guards.ts'

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
  /**
   * Read an optional service without declaring it as a hard dependency.
   *
   * The live model catalog lives on the api-remotes client gateway
   * (`remote.session.modelCatalog`). The card can edit rules without it, so it
   * reads the service through this seam and falls back to the custom rule
   * input when the gateway is absent or no catalog answer arrives.
   */
  get?: (name: string) => unknown
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
  /** Live provider/model catalogue reader; absent when the gateway is absent. */
  catalog?: CatalogLoader
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
.dsh-harness-codex-settings-field { padding: 12px 0; border-top: 0.5px solid var(--dsw-alias-border-l2); }
.dsh-harness-codex-settings-head { display: flex; align-items: center; gap: 8px; }
.dsh-harness-codex-settings-label { flex: 1; min-width: 0; font-size: 13px; font-weight: 500; line-height: 1.5; color: var(--dsw-alias-label-primary); }
.dsh-harness-codex-settings-hint { margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.dsh-harness-codex-settings-note { margin: 12px 0 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.dsh-harness-codex-settings-badge { font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.dsh-harness-codex-settings-reset { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; border: 0; background: none; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dsh-harness-codex-settings-reset:hover { color: var(--dsw-alias-label-primary); }
.dsh-harness-codex-settings-reset:disabled { cursor: default; opacity: 0.5; }
.dsh-harness-codex-settings-reset svg { display: block; }
.dsh-harness-codex-settings-rules { display: flex; flex-direction: column; gap: 6px; margin: 8px 0 0; padding: 0; list-style: none; }
.dsh-harness-codex-settings-rule { display: flex; align-items: center; gap: 8px; min-height: 30px; padding: 0 8px; border: 0.5px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); }
.dsh-harness-codex-settings-rule-text { flex: 1; min-width: 0; font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; }
.dsh-harness-codex-settings-empty { padding: 8px; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.dsh-harness-codex-settings-add { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
.dsh-harness-codex-settings-select { height: 30px; max-width: 220px; padding: 0 8px; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; }
.dsh-harness-codex-settings-input { flex: 1; min-width: 160px; height: 30px; padding: 0 8px; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; }
.dsh-harness-codex-settings-separator { font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.dsh-harness-codex-settings-action { height: 30px; padding: 0 10px; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); font-size: 12px; line-height: 1.5; cursor: pointer; }
.dsh-harness-codex-settings-action:disabled, .dsh-harness-codex-settings-select:disabled, .dsh-harness-codex-settings-input:disabled { cursor: default; opacity: 0.5; }
.dsh-harness-codex-settings-remove { padding: 0 4px; border: 0; background: none; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dsh-harness-codex-settings-remove:disabled { cursor: default; opacity: 0.5; }
.dsh-harness-codex-settings-notice { margin: 8px 0 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.dsh-harness-codex-settings-error { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin: 4px 0 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-state-error-primary); }
`

const FIELD_CLASS = 'dsh-harness-codex-settings-field'
const HEAD_CLASS = 'dsh-harness-codex-settings-head'
const LABEL_CLASS = 'dsh-harness-codex-settings-label'
const HINT_CLASS = 'dsh-harness-codex-settings-hint'
const RULES_CLASS = 'dsh-harness-codex-settings-rules'
const RULE_CLASS = 'dsh-harness-codex-settings-rule'
const RULE_TEXT_CLASS = 'dsh-harness-codex-settings-rule-text'
const EMPTY_CLASS = 'dsh-harness-codex-settings-empty'
const ADD_CLASS = 'dsh-harness-codex-settings-add'
const SELECT_CLASS = 'dsh-harness-codex-settings-select'
const INPUT_CLASS = 'dsh-harness-codex-settings-input'
const SEPARATOR_CLASS = 'dsh-harness-codex-settings-separator'
const ACTION_CLASS = 'dsh-harness-codex-settings-action'
const REMOVE_CLASS = 'dsh-harness-codex-settings-remove'
const NOTICE_CLASS = 'dsh-harness-codex-settings-notice'
const ERROR_CLASS = 'dsh-harness-codex-settings-error'

/** A counterclockwise arrow, drawn with the DSH icon stroke weight. */
const RESET_ICON = h('svg', {
  width: 14,
  height: 14,
  viewBox: '0 0 14 14',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.5,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': true,
}, [
  h('path', { key: 'arc', d: 'M2.5 5.5a4.75 4.75 0 1 0 1.4-3.3L2.5 3.6' }),
  h('path', { key: 'tip', d: 'M2.5 1.2v2.4h2.4' }),
])

/** One model advertised by a configured provider. */
interface CatalogModel {
  id: string
  name: string
}

/** One provider and the models its catalogue answered with. */
interface CatalogGroup {
  id: string
  name: string
  models: readonly CatalogModel[]
}

/** Loading state behind the rule editor's provider and model pickers. */
interface CatalogState {
  status: 'loading' | 'ready' | 'error' | 'unavailable'
  groups: readonly CatalogGroup[]
}

/**
 * Read the live model catalogue, caching one answer per card mount.
 * @param refresh - drop the cached answer and ask the Host again.
 * @returns the catalogue state; never rejects.
 */
type CatalogLoader = (refresh?: boolean) => Promise<CatalogState>

/** The gateway face this card reads; only the model-catalogue call is used. */
interface CatalogGateway {
  modelCatalog: () => Promise<unknown>
}

/**
 * Resolve `remote.session.modelCatalog` through the optional service seam.
 *
 * The card does not declare the gateway as a required service: editing rules
 * works without it, so an absent gateway degrades to the custom rule input
 * instead of leaving the whole form unavailable.
 * @param ctx - the client context.
 * @returns the callable face, or undefined when the gateway is absent.
 */
function catalogGateway(ctx: SettingsContext): CatalogGateway | undefined {
  const remote = ctx.get?.('remote')
  if (!isRecord(remote)) return undefined
  const session = remote.session
  if (!isRecord(session) || typeof session.modelCatalog !== 'function') return undefined
  const call = session.modelCatalog
  return { modelCatalog: () => call.call(session) as Promise<unknown> }
}

/**
 * Narrow the catalogue response to the groups the pickers render.
 * @param response - the gateway's answer.
 * @returns the groups, or undefined when the answer is not a successful catalogue.
 */
function catalogGroups(response: unknown): CatalogGroup[] | undefined {
  if (!isRecord(response) || response.ok !== true || !isRecord(response.value)) return undefined
  const groups = response.value.groups
  if (!Array.isArray(groups)) return undefined
  const parsed: CatalogGroup[] = []
  for (const group of groups) {
    if (!isRecord(group) || typeof group.id !== 'string' || group.id.length === 0) continue
    const models: CatalogModel[] = []
    if (Array.isArray(group.models)) {
      for (const model of group.models) {
        if (!isRecord(model) || typeof model.id !== 'string' || model.id.length === 0) continue
        models.push({ id: model.id, name: typeof model.name === 'string' ? model.name : model.id })
      }
    }
    parsed.push({
      id: group.id,
      name: typeof group.name === 'string' && group.name.length > 0 ? group.name : group.id,
      models,
    })
  }
  return parsed
}

/**
 * Build the card's catalogue reader over the optional gateway.
 * @param ctx - the client context.
 * @returns a loader that caches its answer until asked to refresh.
 */
function createCatalogLoader(ctx: SettingsContext): CatalogLoader {
  let pending: Promise<CatalogState> | undefined
  return (refresh = false) => {
    if (refresh) pending = undefined
    pending ??= (async (): Promise<CatalogState> => {
      const gateway = catalogGateway(ctx)
      if (gateway === undefined) return { status: 'unavailable', groups: [] }
      try {
        const groups = catalogGroups(await gateway.modelCatalog())
        return groups === undefined ? { status: 'error', groups: [] } : { status: 'ready', groups }
      } catch {
        return { status: 'error', groups: [] }
      }
    })()
    return pending
  }
}

/**
 * Read the text a select or input change carries.
 *
 * The type-checker runs without the DOM library (the client entry is checked
 * against the browser module table's contracts, not lib.dom), so React's
 * target types carry no `value` member here. The cast is therefore structural
 * and checked against the value shape instead.
 * @param event - the React change event.
 * @returns the new control text, or an empty string for an unexpected target.
 */
function eventValue(event: { target: unknown }): string {
  const target = event.target
  return isRecord(target) && typeof target.value === 'string' ? target.value : ''
}

/** Display text for one rule: both fields, or the single field it names. */
function ruleLabel(rule: RuleText): string {
  const provider = rule.provider ?? ''
  const model = rule.model ?? ''
  if (provider.length > 0 && model.length > 0) return `${provider} : ${model}`
  return provider.length > 0 ? provider : model
}

/** Model ids once, in catalogue order; the model-only picker spans providers. */
function distinctModels(groups: readonly CatalogGroup[]): CatalogModel[] {
  const seen = new Set<string>()
  const models: CatalogModel[] = []
  for (const group of groups) {
    for (const model of group.models) {
      if (seen.has(model.id)) continue
      seen.add(model.id)
      models.push(model)
    }
  }
  return models
}

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
      props.overridden
        ? h('button', {
          key: 'reset',
          type: 'button',
          className: 'dsh-harness-codex-settings-reset',
          disabled: props.disabled,
          onClick: props.onReset,
          'aria-label': props.resetLabel,
          title: props.resetLabel,
        }, RESET_ICON)
        : null,
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
      props.overridden ? h('span', { key: 'badge', className: 'dsh-harness-codex-settings-badge' }, props.overriddenLabel) : null,
    ]),
    h('p', { key: 'hint', className: HINT_CLASS }, props.hint),
  ])
}

/**
 * The free-form rules editor: the configured rows, a provider/model picker and
 * a wildcard input for values the pickers do not list.
 *
 * Every edit is written back through the form's staged `freeformRules` text,
 * so saving, resetting and discarding keep working exactly as they do for the
 * other fields; only the control around the string changed.
 */
function RulesField(props: {
  id: string
  label: string
  hint: string
  text: string
  overridden: boolean
  disabled: boolean
  overriddenLabel: string
  resetLabel: string
  catalog?: CatalogLoader
  t: (key: string) => string
  onEdit: (text: string) => void
  onReset: () => void
}): ReactNode {
  const { t } = props
  const [catalog, setCatalog] = useState<CatalogState>(() => ({
    status: props.catalog === undefined ? 'unavailable' : 'loading',
    groups: [],
  }))
  const [attempt, setAttempt] = useState(0)
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [custom, setCustom] = useState('')
  const [customInvalid, setCustomInvalid] = useState(false)

  useEffect(() => {
    const load = props.catalog
    if (load === undefined) return
    let live = true
    void load(attempt > 0).then((next) => { if (live) setCatalog(next) })
    return () => { live = false }
  }, [props.catalog, attempt])

  const rules = parseRuleList(props.text)
  const groups = catalog.groups
  const pickable = catalog.status === 'ready'
  const models = provider === ''
    ? distinctModels(groups)
    : groups.find(group => group.id === provider)?.models ?? []

  const edit = (next: RuleText[]): void => { props.onEdit(formatRuleList(next)) }
  const addSelected = (): void => {
    if (provider === '' && model === '') return
    edit(addRule(rules, {
      ...(provider === '' ? {} : { provider }),
      ...(model === '' ? {} : { model }),
    }))
  }
  const addCustom = (): void => {
    const rule = parseRuleEntry(custom)
    if (rule === undefined) {
      setCustomInvalid(true)
      return
    }
    setCustomInvalid(false)
    setCustom('')
    edit(addRule(rules, rule))
  }
  const retry = (): void => {
    setProvider('')
    setModel('')
    setCatalog({ status: 'loading', groups: [] })
    setAttempt(value => value + 1)
  }

  const rows = rules.length === 0
    ? h('li', { key: 'empty', className: EMPTY_CLASS }, t('settings.freeformRulesEmpty'))
    : rules.map((rule, index) => {
      const label = ruleLabel(rule)
      return h('li', { key: `${index}-${label}`, className: RULE_CLASS }, [
        h('span', { key: 'text', className: RULE_TEXT_CLASS }, label),
        h('button', {
          key: 'remove',
          type: 'button',
          className: REMOVE_CLASS,
          disabled: props.disabled,
          'aria-label': `${t('settings.freeformRulesRemove')}: ${label}`,
          onClick: () => edit(removeRuleAt(rules, index)),
        }, t('settings.freeformRulesRemove')),
      ])
    })

  const catalogNotice = catalog.status === 'loading'
    ? h('p', { key: 'loading', className: NOTICE_CLASS, role: 'status' }, t('settings.freeformRulesLoading'))
    : catalog.status === 'error'
      ? h('div', { key: 'error', className: ERROR_CLASS, role: 'alert' }, [
        h('span', { key: 'text' }, t('settings.freeformRulesCatalogError')),
        h('button', {
          key: 'retry',
          type: 'button',
          className: REMOVE_CLASS,
          disabled: props.disabled,
          onClick: retry,
        }, t('settings.freeformRulesRetry')),
      ])
      : catalog.status === 'unavailable'
        ? h('p', { key: 'unavailable', className: NOTICE_CLASS }, t('settings.freeformRulesCatalogUnavailable'))
        : null

  return h('div', { key: props.id, className: FIELD_CLASS }, [
    h('div', { key: 'head', className: HEAD_CLASS }, [
      h('span', { key: 'label', className: LABEL_CLASS }, props.label),
      props.overridden ? h('span', { key: 'badge', className: 'dsh-harness-codex-settings-badge' }, props.overriddenLabel) : null,
      props.overridden
        ? h('button', {
          key: 'reset',
          type: 'button',
          className: 'dsh-harness-codex-settings-reset',
          disabled: props.disabled,
          onClick: props.onReset,
        }, props.resetLabel)
        : null,
    ]),
    h('p', { key: 'hint', className: HINT_CLASS }, props.hint),
    h('ul', { key: 'rules', className: RULES_CLASS, 'aria-label': t('settings.freeformRulesList') }, rows),
    h('div', { key: 'pick', className: ADD_CLASS }, [
      h('select', {
        key: 'provider',
        className: SELECT_CLASS,
        value: provider,
        'aria-label': t('settings.freeformProvider'),
        disabled: props.disabled || !pickable,
        onChange: (event) => {
          setProvider(eventValue(event))
          setModel('')
        },
      }, [
        h('option', { key: 'any', value: '' }, t('settings.freeformAnyProvider')),
        ...groups.map((group, index) => h('option', { key: `${index}-${group.id}`, value: group.id }, group.name)),
      ]),
      h('span', { key: 'separator', className: SEPARATOR_CLASS }, ':'),
      h('select', {
        key: 'model',
        className: SELECT_CLASS,
        value: model,
        'aria-label': t('settings.freeformModel'),
        disabled: props.disabled || !pickable,
        onChange: (event) => { setModel(eventValue(event)) },
      }, [
        h('option', { key: 'any', value: '' }, t('settings.freeformAnyModel')),
        ...models.map((entry, index) => h('option', { key: `${index}-${entry.id}`, value: entry.id }, entry.name)),
      ]),
      h('button', {
        key: 'add',
        type: 'button',
        className: ACTION_CLASS,
        disabled: props.disabled || !pickable || (provider === '' && model === ''),
        onClick: addSelected,
      }, t('settings.freeformRulesAdd')),
    ]),
    h('div', { key: 'custom', className: ADD_CLASS }, [
      h('input', {
        key: 'input',
        className: INPUT_CLASS,
        type: 'text',
        value: custom,
        placeholder: t('settings.freeformCustomRulePlaceholder'),
        'aria-label': t('settings.freeformCustomRule'),
        disabled: props.disabled,
        onChange: (event) => {
          setCustom(eventValue(event))
          setCustomInvalid(false)
        },
        onKeyDown: (event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          addCustom()
        },
      }),
      h('button', {
        key: 'add-custom',
        type: 'button',
        className: ACTION_CLASS,
        disabled: props.disabled || custom.trim().length === 0,
        'aria-label': `${t('settings.freeformRulesAdd')} (${t('settings.freeformCustomRule')})`,
        onClick: addCustom,
      }, t('settings.freeformRulesAdd')),
    ]),
    h('p', { key: 'custom-hint', className: HINT_CLASS }, t('settings.freeformCustomRuleHint')),
    customInvalid ? h('p', { key: 'invalid', className: ERROR_CLASS, role: 'alert' }, t('settings.freeformRulesInvalid')) : null,
    catalogNotice,
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
    h(RulesField, {
      key: 'freeformRules',
      id: '@spectershell/dsh-harness-codex-freeformRules',
      label: t('settings.freeformRules'),
      hint: t('settings.freeformRulesHint'),
      text: state.freeformRules.text,
      overridden: state.freeformRules.overridden,
      disabled: disabled || state.saving,
      overriddenLabel: t('settings.overridden'),
      resetLabel: t('settings.reset'),
      catalog: props.catalog,
      t,
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
    h('p', { key: 'reload', className: 'dsh-harness-codex-settings-note' }, t('settings.reload')),
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
  // One catalogue answer serves every mount of this card; the reader refreshes
  // only when the editor's retry asks for it.
  const loadCatalog = createCatalogLoader(ctx)
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
      inject: () => ({ hooks: { codexSettingsCard: store }, ...form.actions(), catalog: loadCatalog }),
    }, CodexSettingsCard))
    return () => {
      disposeSlot()
      form.dispose()
    }
  }), '@spectershell/dsh-harness-codex: settings card')
}
