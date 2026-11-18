export function truncate(value, width) {
  const text = String(value);
  return text.length <= width ? text : text.slice(0, width - 1) + "…";
}

export function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function escapeCsv(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function joinLines(lines) {
  return lines.filter((line) => line !== "").join("\n");
}
