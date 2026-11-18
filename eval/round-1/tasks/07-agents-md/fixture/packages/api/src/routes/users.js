const USERS = new Map([
  ['1', { id: '1', name: 'Ada' }],
  ['2', { id: '2', name: 'Grace' }]
])

export function findUser(id) {
  return USERS.get(id) ?? null
}
