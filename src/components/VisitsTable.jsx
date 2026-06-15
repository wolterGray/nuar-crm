import {useMemo, useState} from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {Download, ListFilter, MoreVertical, Plus, Search} from "lucide-react";
import {paymentMethods} from "../constants/paymentMethods.js";
import {getTodayInput} from "../utils/dateHelpers.js";
import {formatMoney} from "../utils/formatters.jsx";
import {
  getVisitCommission,
  getVisitDebt,
  getVisitTransactionTotal,
} from "../utils/visits.jsx";
import ClientAutocomplete from "./ClientAutocomplete.jsx";
import VisitMobileCard from "./VisitMobileCard.jsx";
import {useBreakpoint} from "../hooks/useBreakpoint.js";
import PageHeader from "./PageHeader.jsx";
import {
  Badge,
  Button,
  Card,
  Dropdown,
  DropdownContent,
  DropdownItem,
  Input,
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "./ui/index.js";

const parseVisitDateValue = (value) => {
  const date = String(value ?? "").trim();

  if (!date) {
    return 0;
  }

  if (date.includes(".")) {
    const [day, month, year = new Date().getFullYear()] = date.split(".");
    return new Date(`${year}-${month}-${day}T00:00:00`).getTime() || 0;
  }

  return new Date(`${date}T00:00:00`).getTime() || 0;
};

const toSortableNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

function VisitsTable({
  visits,
  title,
  masters,
  filters,
  onFilterChange,
  onResetFilters,
  onAddVisit,
  openActionMenuId,
  onToggleActionMenu,
  onEditVisit,
  onDeleteVisit,
  addLabel = "Добавить операцию",
}) {
  const {isMobile} = useBreakpoint();
  const [sorting, setSorting] = useState([{id: "date", desc: true}]);
  const [globalFilter, setGlobalFilter] = useState("");
  const clientOptions = [...new Set(visits.map((visit) => visit.client))];
  const columns = useMemo(
    () => [
      {
        accessorKey: "date",
        header: "Дата",
        cell: ({row}) => row.original.date,
        sortingFn: (rowA, rowB) =>
          parseVisitDateValue(rowA.original.date) - parseVisitDateValue(rowB.original.date),
      },
      {
        accessorKey: "client",
        header: "Клиент",
        cell: ({row}) => <TooltipCell value={row.original.client} />,
        enableSorting: false,
      },
      {
        accessorKey: "service",
        header: "Услуга",
        cell: ({row}) => (
          <span>
            {row.original.service}
            {row.original.isPlanned && (
              <Badge className="table-planned-badge" variant="success">
                Запланирован
              </Badge>
            )}
          </span>
        ),
      },
      {
        accessorKey: "master",
        header: "Работник",
        cell: ({row}) => row.original.master,
      },
      {
        accessorKey: "amount",
        header: "Стоимость",
        cell: ({row}) => formatMoney(row.original.amount),
        sortingFn: (rowA, rowB) =>
          toSortableNumber(rowA.original.amount) - toSortableNumber(rowB.original.amount),
      },
      {
        accessorKey: "payment",
        header: "Оплата",
        cell: ({row}) => {
          const visit = row.original;

          return (
            <TooltipCell
              className={String(visit.payment ?? "").includes("Пакет") ? "package" : ""}
              value={visit.payment || "Не указано"}
              tooltip={
                visit.packageName
                  ? `${visit.packageName}: списано ${visit.packageSessionsUsed || 1}`
                  : visit.payment || "Не указано"
              }
            />
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "tip",
        header: "Чай",
        cell: ({row}) => formatMoney(row.original.tip),
        enableSorting: false,
      },
      {
        id: "commission",
        header: "Комиссия",
        cell: ({row}) => (
          <TooltipCell
            value={formatMoney(getVisitCommission(row.original))}
            tooltip={row.original.commissionType ?? "Без комиссии"}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "extra",
        header: "Доп сумма",
        cell: ({row}) => formatMoney(row.original.extra),
        enableSorting: false,
      },
      {
        id: "debt",
        header: "Долг",
        cell: ({row}) => (
          <span className={getVisitDebt(row.original) > 0 ? "debt-cell" : ""}>
            {formatMoney(getVisitDebt(row.original))}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "discount",
        header: "Скидка",
        cell: ({row}) => `${Number(row.original.discount) || 0}%`,
        enableSorting: false,
      },
      {
        id: "total",
        header: "Итог",
        cell: ({row}) => (
          <span className="total-cell">
            {formatMoney(getVisitTransactionTotal(row.original))}
          </span>
        ),
        sortingFn: (rowA, rowB) =>
          getVisitTransactionTotal(rowA.original) - getVisitTransactionTotal(rowB.original),
      },
      {
        id: "actions",
        header: "",
        cell: ({row}) => {
          const visit = row.original;

          return (
            <Dropdown
              className="row-actions"
              onClick={(event) => event.stopPropagation()}>
              <Button
                aria-label="Действия"
                className="row-action"
                size="icon"
                variant="ghost"
                onClick={() =>
                  onToggleActionMenu(
                    openActionMenuId === visit.id ? null : visit.id,
                  )
                }>
                <MoreVertical size={17} />
              </Button>
              {openActionMenuId === visit.id && (
                <DropdownContent className="row-action-menu">
                  {onEditVisit && (
                    <DropdownItem onClick={() => onEditVisit(visit)}>
                      Редактировать
                    </DropdownItem>
                  )}
                  {onDeleteVisit && (
                    <DropdownItem
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => onDeleteVisit(visit)}>
                      Удалить
                    </DropdownItem>
                  )}
                </DropdownContent>
              )}
            </Dropdown>
          );
        },
        enableSorting: false,
        enableGlobalFilter: false,
      },
    ],
    [
      onDeleteVisit,
      onEditVisit,
      onToggleActionMenu,
      openActionMenuId,
    ],
  );
  const table = useReactTable({
    data: visits,
    columns,
    state: {
      globalFilter,
      sorting,
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const query = String(filterValue ?? "").trim().toLowerCase();

      if (!query) {
        return true;
      }

      return [row.original.client, row.original.master, row.original.service]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const hasVisits = visits.length > 0;
  const hasSearch = globalFilter.trim().length > 0;
  const exportVisits = () => {
    const columns = [
      ["Дата", (visit) => visit.date],
      ["Клиент", (visit) => visit.client],
      ["Услуга", (visit) => visit.service],
      ["Работник", (visit) => visit.master],
      ["Стоимость", (visit) => visit.amount],
      ["Оплата", (visit) => visit.payment],
      ["Чай", (visit) => visit.tip],
      ["Комиссия", (visit) => getVisitCommission(visit)],
      ["Доп сумма", (visit) => visit.extra],
      ["Долг", (visit) => getVisitDebt(visit)],
      ["Скидка %", (visit) => visit.discount],
      ["Итог", (visit) => getVisitTransactionTotal(visit)],
      ["Комментарий", (visit) => visit.note],
    ];
    const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      columns.map(([label]) => escapeCell(label)).join(";"),
      ...visits.map((visit) =>
        columns.map(([, getValue]) => escapeCell(getValue(visit))).join(";"),
      ),
    ].join("\n");
    const link = document.createElement("a");

    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], {type: "text/csv;charset=utf-8"}));
    link.download = `nuar-visits-${getTodayInput()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <Card className="panel visits-panel">
      <PageHeader
        actions={
          <>
            <Button
              aria-label="Экспорт CSV"
              className={`secondary-button ${isMobile ? "payments-toolbar-icon-only" : ""}`}
              type="button"
              onClick={exportVisits}>
              <Download size={16} />
              <span>{isMobile ? "CSV" : "Экспорт CSV"}</span>
            </Button>
            <Button
              aria-label="Сбросить фильтры"
              className={`secondary-button ${isMobile ? "payments-toolbar-icon-only" : ""}`}
              onClick={onResetFilters}>
              <ListFilter size={16} />
              <span>{isMobile ? "Сброс" : "Сбросить"}</span>
            </Button>
            {onAddVisit && (
              <Button
                aria-label={addLabel}
                className={`add-visit-button ${isMobile ? "payments-toolbar-icon-only" : ""}`}
                type="button"
                variant="primary"
                onClick={onAddVisit}>
                <Plus size={16} />
                <span>{isMobile ? "Добавить" : addLabel}</span>
              </Button>
            )}
          </>
        }
        description={`${rows.length} из ${visits.length} записей`}
        title={title}
      />

      <div className="table-search">
        <Search size={16} />
        <Input
          type="search"
          placeholder="Поиск: клиент, мастер, услуга"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
        />
      </div>

      {isMobile ? (
        <details className="payments-filters-collapsible">
          <summary>Фильтры</summary>
          <div className="table-filters">
            <label>
              Сотрудник
              <select
                value={filters.master}
                onChange={(event) => onFilterChange("master", event.target.value)}>
                <option value="">Все</option>
                {masters.map((master) => (
                  <option key={master}>{master}</option>
                ))}
              </select>
            </label>
            <label>
              Оплата
              <select
                value={filters.payment}
                onChange={(event) => onFilterChange("payment", event.target.value)}>
                <option value="">Все</option>
                {paymentMethods.map((payment) => (
                  <option key={payment}>{payment}</option>
                ))}
              </select>
            </label>
            <label>
              Клиент
              <ClientAutocomplete
                clients={clientOptions}
                id="visit-filter-client-options"
                name="client-filter"
                placeholder="Все клиенты"
                value={filters.client}
                onChange={(event) => onFilterChange("client", event.target.value)}
              />
            </label>
            <label>
              Дата
              <input
                type="date"
                value={filters.date}
                onChange={(event) => onFilterChange("date", event.target.value)}
              />
            </label>
          </div>
        </details>
      ) : (
      <div className="table-filters">
        <label>
          Сотрудник
          <select
            value={filters.master}
            onChange={(event) => onFilterChange("master", event.target.value)}>
            <option value="">Все</option>
            {masters.map((master) => (
              <option key={master}>{master}</option>
            ))}
          </select>
        </label>
        <label>
          Оплата
          <select
            value={filters.payment}
            onChange={(event) => onFilterChange("payment", event.target.value)}>
            <option value="">Все</option>
            {paymentMethods.map((payment) => (
              <option key={payment}>{payment}</option>
            ))}
          </select>
        </label>
        <label>
          Клиент
          <ClientAutocomplete
            clients={clientOptions}
            id="visit-filter-client-options"
            name="client-filter"
            placeholder="Все клиенты"
            value={filters.client}
            onChange={(event) => onFilterChange("client", event.target.value)}
          />
        </label>
        <label>
          Дата
          <input
            type="date"
            value={filters.date}
            onChange={(event) => onFilterChange("date", event.target.value)}
          />
        </label>
      </div>
      )}

      <div className="visits-mobile-list">
        {rows.map((row) => {
          const visit = row.original;

          return (
            <VisitMobileCard
              isPlanned={visit.isPlanned}
              key={visit.id}
              showMaster
              showStatus={Boolean(visit.status)}
              visit={visit}
              onDelete={onDeleteVisit}
              onEdit={onEditVisit}
            />
          );
        })}
      </div>

      <Table className="visits-table visits-table-desktop">
        <TableHeader className="table-row table-head">
          {table.getFlatHeaders().map((header) => (
            <TableCell key={header.id}>
              {header.column.getCanSort() ? (
                <Button
                  className="table-sort-button"
                  type="button"
                  variant="ghost"
                  onClick={header.column.getToggleSortingHandler()}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  <SortMark direction={header.column.getIsSorted()} />
                </Button>
              ) : (
                flexRender(header.column.columnDef.header, header.getContext())
              )}
            </TableCell>
          ))}
        </TableHeader>
        {rows.map((row) => (
          <TableRow
            className={`table-row ${row.original.isPlanned ? "table-row-planned" : ""}`}
            key={row.original.id}>
            {row.getVisibleCells().map((cell) =>
              cell.column.id === "actions" ? (
                <TableCell as="div" className="table-actions-cell" key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ) : ["client", "payment", "commission"].includes(cell.column.id) ? (
                <TableCell as="div" className="table-visible-cell" key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ) : (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ),
            )}
          </TableRow>
        ))}
        {!hasVisits && (
          <div className="table-empty-state">
            <strong>Визитов пока нет</strong>
            <span>Добавьте первый визит или поступление, и оно появится здесь.</span>
          </div>
        )}
        {hasVisits && rows.length === 0 && (
          <div className="table-empty-state">
            <strong>Ничего не найдено</strong>
            <span>
              {hasSearch
                ? "Попробуйте изменить поиск по клиенту, мастеру или услуге."
                : "Попробуйте изменить фильтры таблицы."}
            </span>
          </div>
        )}
      </Table>

      <footer className="table-footer">
        <span>Визитов: {rows.length} из {visits.length}</span>
      </footer>
    </Card>
  );
}
function SortMark({direction}) {
  if (!direction) {
    return <span className="table-sort-mark">↕</span>;
  }

  return <span className="table-sort-mark">{direction === "asc" ? "↑" : "↓"}</span>;
}

function TooltipCell({value, tooltip = value, className = ""}) {
  return (
    <span className={`tooltip-cell ${className}`} tabIndex="0">
      <span className="cell-value">{value}</span>
      <span className="cell-tooltip" role="tooltip">
        {tooltip}
      </span>
    </span>
  );
}

export default VisitsTable;
