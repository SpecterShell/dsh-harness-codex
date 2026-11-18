export function parseIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`not a date: ${value}`);
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

export function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(value, days) {
  const date = parseIso(value);
  return isoDate(new Date(date.getTime() + days * 86_400_000));
}

export function monthStart(value) {
  return `${value.slice(0, 7)}-01`;
}
