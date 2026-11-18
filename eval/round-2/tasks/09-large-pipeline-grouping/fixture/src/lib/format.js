export function padRight(value, width) {
  const text = String(value);
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

export function padLeft(value, width) {
  const text = String(value);
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

export function table(headers, rows) {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => String(row[index]).length), 1),
  );
  const render = (cells) =>
    cells
      .map((cell, index) =>
        index === cells.length - 1 ? padLeft(cell, widths[index]) : padRight(cell, widths[index]),
      )
      .join("  ")
      .trimEnd();
  return [render(headers), ...rows.map(render)].join("\n");
}
