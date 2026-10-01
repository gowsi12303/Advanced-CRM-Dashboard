// Minimal CSV writing (RFC 4180). Small enough not to need a dependency.

const NEEDS_QUOTES = /[",\r\n]/;
// A cell starting with one of these is run as a formula by spreadsheet apps.
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV cell. Text containing a comma, quote or line break is quoted with
 * its quotes doubled. Text that a spreadsheet would treat as a formula (for
 * example a phone number starting with "+") is prefixed with an apostrophe,
 * which spreadsheets read as "this is text" and do not display.
 */
export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** A complete CSV document with a header row and CRLF line endings. */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
}

/** Saves text as a file from the browser. */
export function downloadTextFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Saves CSV text as a download. The BOM makes Excel read it as UTF-8. */
export function downloadCsv(filename: string, csv: string) {
  downloadTextFile(filename, `﻿${csv}`, "text/csv;charset=utf-8");
}
