import { clientLogger } from "./client-logger";

function normalizeExportValue(value: unknown) {
  if (value == null) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(" | ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function csvCell(value: unknown) {
  const text = normalizeExportValue(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];

  if (columns.length === 0) {
    return "";
  }

  return [
    columns.map(csvCell).join(","),
    ...rows.map((row) =>
      columns.map((column) => csvCell(row[column])).join(",")
    ),
  ].join("\n");
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);

  clientLogger.info("download-file", {
    filename,
    mimeType,
    size: content.length,
  });
}

export function downloadCsvFile(
  filename: string,
  rows: Array<Record<string, unknown>>
) {
  downloadTextFile(filename, rowsToCsv(rows), "text/csv;charset=utf-8");
}

export function downloadJsonFile(filename: string, value: unknown) {
  downloadTextFile(
    filename,
    JSON.stringify(value, null, 2),
    "application/json;charset=utf-8"
  );
}
