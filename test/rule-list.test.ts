/**
 * Prove the rule text helpers the settings card edits through.
 *
 * The card keeps the stored value a newline-joined string, so these helpers
 * are the only place that knows the line dialect besides the freeform bridge.
 * Parsing must agree with the bridge, formatting must round-trip, and list
 * edits must preserve order while keeping exact duplicates out.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addRule, formatRuleList, parseRuleEntry, parseRuleList, removeRuleAt,
} from '../src/config.ts'
import { parseRuleText } from '../src/freeform/rules.ts'

test('rule text parses provider, model and both', () => {
  assert.deepEqual(parseRuleList('openai:gpt-5\nopenai:\n:gpt-5'), [
    { provider: 'openai', model: 'gpt-5' },
    { provider: 'openai' },
    { model: 'gpt-5' },
  ])
  // Whitespace around either field is part of the editor's dialect, and CRLF
  // lines arrive from a saved value written on Windows.
  assert.deepEqual(parseRuleList('  openai :  gpt-5  \r\n\r\n'), [
    { provider: 'openai', model: 'gpt-5' },
  ])
  // A model id that itself contains a colon keeps it: only the first colon
  // separates the provider from the model.
  assert.deepEqual(parseRuleList('openai:org/model:beta'), [
    { provider: 'openai', model: 'org/model:beta' },
  ])
})

test('malformed lines are skipped instead of parsed into match-all rules', () => {
  assert.deepEqual(parseRuleList('*\n:\n   \nopenai:gpt-5'), [
    { provider: 'openai', model: 'gpt-5' },
  ])
})

test('formatting writes the bridge dialect and round-trips', () => {
  const rules = [
    { provider: 'openai', model: 'gpt-*' },
    { provider: 'openai' },
    { model: 'gpt-6*' },
  ]
  assert.equal(formatRuleList(rules), 'openai:gpt-*\nopenai:\n:gpt-6*')
  assert.deepEqual(parseRuleList(formatRuleList(rules)), rules)
  // A rule naming neither field would serialize as a lone separator, which the
  // bridge ignores; formatting drops it instead of writing dead text.
  assert.equal(formatRuleList([{ provider: 'a', model: 'b' }, {}]), 'a:b')
  assert.equal(formatRuleList([]), '')
})

test('wildcards survive parsing, formatting and list edits', () => {
  const wildcard = { provider: 'openai', model: 'gpt-*' }
  assert.deepEqual(parseRuleList(formatRuleList([wildcard])), [wildcard])
  assert.deepEqual(addRule([], wildcard), [wildcard])
  // A wildcard pattern is a value of its own, not a duplicate of the literal
  // text it happens to look like.
  assert.deepEqual(addRule([{ provider: 'openai', model: 'gpt-5' }], wildcard), [
    { provider: 'openai', model: 'gpt-5' },
    wildcard,
  ])
})

test('adding a rule appends it once and keeps the written order', () => {
  const first = addRule([], { provider: 'openai', model: 'gpt-5' })
  const second = addRule(first, { provider: 'anthropic' })
  assert.deepEqual(second, [{ provider: 'openai', model: 'gpt-5' }, { provider: 'anthropic' }])
  assert.deepEqual(addRule(second, { provider: 'openai', model: 'gpt-5' }), second)
  assert.deepEqual(addRule(second, {}), second)
  // Add does not mutate the list it was given.
  assert.deepEqual(second, [{ provider: 'openai', model: 'gpt-5' }, { provider: 'anthropic' }])
})

test('removing a rule drops only that row', () => {
  const rules = [
    { provider: 'openai', model: 'gpt-5' },
    { provider: 'openai' },
    { model: 'gpt-6*' },
  ]
  assert.deepEqual(removeRuleAt(rules, 1), [
    { provider: 'openai', model: 'gpt-5' },
    { model: 'gpt-6*' },
  ])
  assert.deepEqual(removeRuleAt(rules, 99), rules)
  assert.deepEqual(removeRuleAt(rules, -1), rules)
  assert.deepEqual(rules, [
    { provider: 'openai', model: 'gpt-5' },
    { provider: 'openai' },
    { model: 'gpt-6*' },
  ], 'the input list is not mutated')
})

test('the custom input accepts a bare model pattern', () => {
  // A bare word is a model pattern: model ids copied from providers commonly
  // contain a slash and no colon.
  assert.deepEqual(parseRuleEntry('gpt-*'), { model: 'gpt-*' })
  assert.deepEqual(parseRuleEntry('openai/gpt-*'), { model: 'openai/gpt-*' })
  assert.deepEqual(parseRuleEntry('openai:gpt-*'), { provider: 'openai', model: 'gpt-*' })
  assert.deepEqual(parseRuleEntry('openai:'), { provider: 'openai' })
  assert.deepEqual(parseRuleEntry(':gpt-*'), { model: 'gpt-*' })
  assert.deepEqual(parseRuleEntry('  openai : gpt-5  '), { provider: 'openai', model: 'gpt-5' })
})

test('the custom input rejects blank text and a lone separator', () => {
  assert.equal(parseRuleEntry(''), undefined)
  assert.equal(parseRuleEntry('   '), undefined)
  assert.equal(parseRuleEntry(':'), undefined)
  assert.equal(parseRuleEntry('  :  '), undefined)
})

test('the editor parser and the bridge parser agree on stored text', () => {
  const text = [
    'openai:gpt-*',
    'openai:',
    ':gpt-6*',
    '*:*',
    '  spaced : model  ',
    '*',
    ':',
    '',
    'provider:with:colons',
  ].join('\n')
  assert.deepEqual(parseRuleList(text), parseRuleText(text))
})
