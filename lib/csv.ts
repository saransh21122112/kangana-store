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

/**
 * Parses an RFC 4180 CSV string into an array of header-keyed row objects.
 * Hand-rolled rather than pulling in a dependency (no CSV-parsing package
 * is in `package.json`, and the app's only import need is this one
 * inventory round-trip) — but still handles what a naive `line.split(",")`
 * gets wrong: quoted fields containing commas, escaped `""` quotes inside a
 * quoted field, and quoted fields containing embedded newlines (a product
 * `name` could plausibly contain any of these). The first row is always
 * treated as the header; its cells become the keys of every subsequent
 * row's object. Blank trailing lines are skipped.
 */
export function parseCsv(input: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  // Flush the final cell/row if the input didn't end with a newline.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  if (nonEmptyRows.length === 0) return [];

  const [header, ...dataRows] = nonEmptyRows;
  return dataRows.map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, idx) => {
      record[key] = cells[idx] ?? "";
    });
    return record;
  });
}
