import { handleHealth } from './routes/health.js'

const routes = {
  'GET /health': handleHealth
}

export function handle(method, path) {
  const handler = routes[`${method} ${path}`]
  if (!handler) {
    return { status: 404, body: { data: null, error: 'not found' } }
  }
  return handler()
}
