import { handleHealth } from './routes/health.js'
import { findUser } from './routes/users.js'

const routes = [
  { method: 'GET', pattern: /^\/health$/, handler: handleHealth }
]

export function handle(method, path) {
  for (const route of routes) {
    if (route.method !== method) continue
    const match = route.pattern.exec(path)
    if (match) return route.handler(...match.slice(1))
  }
  return { status: 404, body: { data: null, error: 'not found' } }
}

export { findUser }
