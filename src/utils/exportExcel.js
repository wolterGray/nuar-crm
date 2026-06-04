import * as XLSX from "xlsx";

const toSafeSheetName = (name) => String(name || "Отчет").slice(0, 31);

export const exportRowsToExcel = ({
  columns,
  fileName = "nuar-report.xlsx",
  rows,
  sheetName = "Отчет",
}) => {
  const normalizedRows = rows.map((row) =>
    columns.reduce((result, column) => {
      result[column.label] =
        typeof column.value === "function"
          ? column.value(row)
          : row[column.value ?? column.key];
      return result;
    }, {}),
  );
  const worksheet = XLSX.utils.json_to_sheet(normalizedRows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, toSafeSheetName(sheetName));
  XLSX.writeFile(workbook, fileName);
};
