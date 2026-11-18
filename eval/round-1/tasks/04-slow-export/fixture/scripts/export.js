import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { buildSummary } from '../lib/summary.js'

const DELAY_MS = process.env.FAST === '1' ? 0 : 14000
const STEPS = 7

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const csv = readFileSync(new URL('../data/orders.csv', import.meta.url), 'utf8')
const rows = csv
  .trim()
  .split('\n')
  .slice(1)
  .map((line) => {
    const [orderId, customer, quantity, unitPriceCents] = line.split(',')
    return {
      order_id: Number(orderId),
      customer,
      quantity: Number(quantity),
      unit_price_cents: Number(unitPriceCents)
    }
  })

console.log(`loaded ${rows.length} orders`)

const started = Date.now()
for (let step = 1; step <= STEPS; step += 1) {
  await sleep(DELAY_MS / STEPS)
  console.log(`processed ${step}/${STEPS}`)
}

const summary = buildSummary(rows)
mkdirSync(new URL('../out/', import.meta.url), { recursive: true })
writeFileSync(
  new URL('../out/summary.json', import.meta.url),
  `${JSON.stringify(summary, null, 2)}\n`
)

console.log(`wrote out/summary.json in ${Date.now() - started}ms`)
