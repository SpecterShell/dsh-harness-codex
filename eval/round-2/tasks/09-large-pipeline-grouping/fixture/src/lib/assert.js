export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function assertInteger(value, name) {
  assert(Number.isInteger(value), `${name} must be an integer`);
  return value;
}

export function assertPositive(value, name) {
  assertInteger(value, name);
  assert(value > 0, `${name} must be positive`);
  return value;
}

export function assertOneOf(value, allowed, name) {
  assert(allowed.includes(value), `${name} must be one of ${allowed.join(", ")}`);
  return value;
}
