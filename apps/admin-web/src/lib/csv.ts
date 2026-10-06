type Cell = string | number | boolean | null | undefined;

function escape(value: Cell) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Cell[][]) {
  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
}

export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const blob = new Blob([toCsv(header, rows)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
