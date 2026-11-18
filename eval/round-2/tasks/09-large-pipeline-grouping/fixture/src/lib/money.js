export function parseCents(value) {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error(`not an integer amount: ${value}`);
    return value;
  }
  const text = String(value).trim();
  if (!/^-?\d+$/.test(text)) throw new Error(`not an integer amount: ${value}`);
  return Number(text);
}

export function sumCents(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function formatCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const rest = String(absolute % 100).padStart(2, "0");
  return `${sign}$${dollars.toLocaleString("en-US")}.${rest}`;
}
