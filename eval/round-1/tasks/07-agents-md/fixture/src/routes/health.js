export function handleHealth() {
  return { status: 200, body: { data: { status: 'ok' }, error: null } }
}
