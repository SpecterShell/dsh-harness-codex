export function match(pattern, path) {
  const match = pattern.exec(path)
  return match ? match.slice(1) : null
}
