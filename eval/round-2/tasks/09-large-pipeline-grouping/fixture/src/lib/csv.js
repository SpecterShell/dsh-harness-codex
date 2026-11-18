export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function rowsFromCsv(text, { required = [] } = {}) {
  const table = parseCsv(text);
  if (table.length === 0) return [];
  const header = table[0].map((name) => name.trim());
  for (const name of required) {
    if (!header.includes(name)) throw new Error(`missing column: ${name}`);
  }
  return table.slice(1)
    .filter((cells) => cells.some((cell) => cell !== ""))
    .map((cells) => {
      const row = {};
      header.forEach((name, index) => {
        row[name] = cells[index] ?? "";
      });
      return row;
    });
}
