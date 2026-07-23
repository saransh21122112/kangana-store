/** A single CSV column: `key` reads from each row's record, `header` is the header cell. */
export interface CsvColumn {
  key: string;
  header: string;
}

/**
 * Escapes a single CSV cell value. Per RFC 4180: if the value contains a
 * comma, double quote, or newline, wrap it in double quotes and double up
 * any internal double quotes. `null`/`undefined` become an empty cell.
 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let str: string;
  if (value instanceof Date) {
    str = value.toISOString();
  } else {
    str = String(value);
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes an array of plain-object rows into a CSV string (header row +
 * one row per record), using CRLF line endings as RFC 4180 recommends.
 */
export function toCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const headerLine = columns.map((c) => escapeCell(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCell(row[c.key])).join(","));
  return [headerLine, ...lines].join("\r\n") + "\r\n";
}
