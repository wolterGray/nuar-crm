const toSafeSheetName = (name) => String(name || "Отчет").slice(0, 31);

const toCellValue = (value) => {
  if (value === null || value === undefined) return "";
  if (["boolean", "number", "string"].includes(typeof value) || value instanceof Date) {
    return value;
  }
  return String(value);
};

export const exportRowsToExcel = async ({
  columns,
  fileName = "nuar-report.xlsx",
  rows,
  sheetName = "Отчет",
}) => {
  const {default: writeXlsxFile} = await import("write-excel-file/browser");
  const data = [
    columns.map((column) => ({value: column.label, fontWeight: "bold", wrap: true})),
    ...rows.map((row) =>
      columns.map((column) => ({
        value: toCellValue(
          typeof column.value === "function"
            ? column.value(row)
            : row[column.value ?? column.key],
        ),
        wrap: true,
      })),
    ),
  ];

  await writeXlsxFile(data, {
    columns: columns.map((column) => ({width: Math.max(12, Math.min(36, column.label.length + 4))})),
    sheet: toSafeSheetName(sheetName),
    stickyRowsCount: 1,
  }).toFile(fileName);
};
