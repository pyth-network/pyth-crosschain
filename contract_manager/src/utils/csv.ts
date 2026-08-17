import { writeFileSync } from "node:fs";

function toCsvField(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Write `rows` as CSV, the first row being the header. */
export function writeCsv(filePath: string, rows: (string | number)[][]) {
  writeFileSync(
    filePath,
    rows.map((row) => row.map(toCsvField).join(",")).join("\n") + "\n",
  );
}
