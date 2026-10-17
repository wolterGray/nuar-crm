import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {paymentMethods} from "../constants/paymentMethods.js";
import {formatMoney, toDisplayDate} from "../utils/formatters.jsx";
import {
  getVisitCommission,
  getVisitDebt,
  getVisitTransactionTotal,
} from "../utils/visits.jsx";
import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {RowActionsMenu} from "./RowActionMenuPortal.jsx";
import {AppIcon, Badge, Button, IconButton, PaginationBar} from "./ui/index.js";
import {calculateDynamicPageSize} from "../utils/pagination.js";

const parseVisitDateValue = (value) => {
  const date = String(value ?? "").trim();
  if (!date) return 0;
  if (date.includes(".")) {
    const [day, month, year = new Date().getFullYear()] = date.split(".");
    return new Date(`${year}-${month}-${day}T00:00:00`).getTime() || 0;
  }
  return new Date(`${date}T00:00:00`).getTime() || 0;
};

const getPaymentIcon = (method) => {
  const m = String(method || "").toLowerCase();
  if (m.includes("карт") || m.includes("mono") || m.includes("blik")) return "creditCard";
  if (m.includes("нал")) return "banknote";
  if (m.includes("пакет")) return "package";
  if (m.includes("сертиф")) return "gift";
  return "wallet";
};

function VisitsTable({
  filters,
  masters = [],
  onDeleteVisit,
  onEditVisit,
  onFilterChange,
  onResetFilters,
  onToggleActionMenu,
  openActionMenuId,
  visits = [],
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState(new Set());
  const [showExtraFilters, setShowExtraFilters] = useState(false);
  const tableWrapRef = useRef(null);
  const [autoPageSize, setAutoPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const container = tableWrapRef.current;
    if (!container) return undefined;

    const update = () => {
      if (window.innerWidth <= 768) {
        setAutoPageSize(12);
        return;
      }
      const h = container.clientHeight;
      if (h > 0) {
        const count = calculateDynamicPageSize(h, 38, 46, 5, 8);
        setAutoPageSize((prev) => (prev !== count ? count : prev));
      }
    };

    update();

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        if (window.innerWidth <= 768) {
          setAutoPageSize(12);
          return;
        }
        for (const entry of entries) {
          const h = entry.contentRect.height;
          if (h > 0) {
            const count = calculateDynamicPageSize(h, 38, 46, 5, 8);
            setAutoPageSize((prev) => (prev !== count ? count : prev));
          }
        }
      });
      ro.observe(container);
    }

    window.addEventListener("resize", update);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const pageSize = autoPageSize;
  const extraFilterCount = [filters.client, filters.date].filter(Boolean).length;

  const safeVisits = useMemo(
    () => (Array.isArray(visits) ? visits.filter(Boolean) : []),
    [visits],
  );

  const clientOptions = useMemo(
    () => [
      ...new Set(
        safeVisits
          .map((visit) => String(visit.client ?? "").trim())
          .filter(Boolean),
      ),
    ],
    [safeVisits],
  );

  const toggleRowExpanded = useCallback((id) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSortToggle = (field) => {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredVisits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = safeVisits;

    if (query) {
      result = result.filter((visit) => {
        const text = [visit.client, visit.master, visit.service, visit.payment]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(query);
      });
    }

    return [...result].sort((a, b) => {
      let diff = 0;
      if (sortField === "date") {
        diff = parseVisitDateValue(a.date) - parseVisitDateValue(b.date);
      } else if (sortField === "total") {
        diff = getVisitTransactionTotal(a) - getVisitTransactionTotal(b);
      } else if (sortField === "amount") {
        diff = (Number(a.amount) || 0) - (Number(b.amount) || 0);
      }
      return sortAsc ? diff : -diff;
    });
  }, [safeVisits, searchQuery, sortAsc, sortField]);

  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const pagedVisits = useMemo(() => {
    if (pageSize >= 999999) return filteredVisits;
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredVisits.slice(start, start + pageSize);
  }, [filteredVisits, pageSize, safeCurrentPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="payments-journal-container flex-1 min-h-0 h-full flex flex-col overflow-hidden">
      {/* 1. Compact Filter Bar */}
      <div className="payments-filter-bar shrink-0">
        <div className="payments-search-wrap">
          <AppIcon className="payments-search-icon" name="search" size="xs" />
          <input
            className="payments-search-input"
            placeholder="Клиент или услуга..."
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery ? (
            <button
              aria-label="Очистить поиск"
              className="payments-search-clear"
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
              }}
            >
              <AppIcon name="x" size="xs" />
            </button>
          ) : null}
        </div>

        <div className="payments-select-wrap">
          <select
            aria-label="Фильтр по мастеру"
            className="payments-filter-select"
            value={filters.master || ""}
            onChange={(e) => onFilterChange("master", e.target.value)}
          >
            <option value="">Все мастера</option>
            {masters.map((master) => (
              <option key={master} value={master}>
                {master}
              </option>
            ))}
          </select>
          <AppIcon className="payments-select-arrow" name="chevronDown" size="xs" />
        </div>

        <div className="payments-select-wrap">
          <select
            aria-label="Фильтр по способу оплаты"
            className="payments-filter-select"
            value={filters.payment || ""}
            onChange={(e) => onFilterChange("payment", e.target.value)}
          >
            <option value="">Все способы</option>
            {paymentMethods.map((payment) => (
              <option key={payment} value={payment}>
                {payment}
              </option>
            ))}
          </select>
          <AppIcon className="payments-select-arrow" name="chevronDown" size="xs" />
        </div>

        <div className="payments-date-control-wrap payments-date-control-primary">
          <AppIcon className="payments-date-icon" name="calendar" size="xs" />
          <span className="payments-date-label">
            {filters.date ? toDisplayDate(filters.date) : "Все даты"}
          </span>
          {filters.date ? (
            <button
              aria-label="Сбросить дату"
              className="payments-date-clear"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFilterChange("date", "");
              }}
            >
              <AppIcon name="x" size="xs" />
            </button>
          ) : (
            <AppIcon className="payments-date-arrow" name="chevronDown" size="xs" />
          )}
          <input
            aria-label="Выбрать дату"
            className="payments-date-native-input"
            type="date"
            value={filters.date || ""}
            onChange={(e) => onFilterChange("date", e.target.value)}
          />
        </div>

        <button
          aria-expanded={showExtraFilters}
          className={`payments-filter-toggle-btn ${showExtraFilters || extraFilterCount ? "is-active" : ""}`}
          type="button"
          onClick={() => setShowExtraFilters((prev) => !prev)}
        >
          <AppIcon name="sliders" size="xs" />
          <span>Фильтры</span>
          {extraFilterCount ? (
            <span className="payments-filter-badge">{extraFilterCount}</span>
          ) : null}
        </button>
      </div>

      {/* Expandable Extra Filters (Client & Reset) */}
      {showExtraFilters ? (
        <div className="payments-extra-filters-panel">
          <div className="payments-extra-filter-item">
            <span className="payments-extra-filter-label">Клиент:</span>
            <ClientAutocomplete
              clients={clientOptions}
              id="visit-filter-client-options"
              name="client-filter"
              placeholder="Все клиенты"
              value={filters.client || ""}
              onChange={(event) => onFilterChange("client", event.target.value)}
            />
          </div>
          <div className="payments-extra-filter-item payments-mobile-date-filter">
            <span className="payments-extra-filter-label">Дата:</span>
            <div className="payments-date-control-wrap">
              <AppIcon className="payments-date-icon" name="calendar" size="xs" />
              <span className="payments-date-label">
                {filters.date ? toDisplayDate(filters.date) : "Все даты"}
              </span>
              {filters.date ? (
                <button
                  aria-label="Сбросить дату"
                  className="payments-date-clear"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFilterChange("date", "");
                  }}
                >
                  <AppIcon name="x" size="xs" />
                </button>
              ) : (
                <AppIcon className="payments-date-arrow" name="chevronDown" size="xs" />
              )}
              <input
                aria-label="Выбрать дату"
                className="payments-date-native-input"
                type="date"
                value={filters.date || ""}
                onChange={(event) => onFilterChange("date", event.target.value)}
              />
            </div>
          </div>
          <div className="payments-extra-filter-actions">
            <Button
              leftIcon="rotateCcw"
              size="sm"
              variant="ghost"
              onClick={() => {
                onResetFilters?.();
                setSearchQuery("");
                setCurrentPage(1);
              }}
            >
              Сбросить фильтры
            </Button>
          </div>
        </div>
      ) : null}

      {/* 2. Journal Table */}
      <div ref={tableWrapRef} className="payments-table-wrap flex-1 min-h-0 overflow-y-auto">
        <table className="payments-table">
          <thead>
            <tr>
              <th
                className="payments-th-date is-sortable"
                onClick={() => handleSortToggle("date")}
              >
                <span>Дата</span>
                {sortField === "date" ? (
                  <AppIcon name={sortAsc ? "chevronUp" : "chevronDown"} size="xs" />
                ) : null}
              </th>
              <th className="payments-th-client">Клиент</th>
              <th className="payments-th-service">Услуга</th>
              <th className="payments-th-master">Мастер</th>
              <th className="payments-th-payment">Способ</th>
              <th
                className="payments-th-total is-sortable text-right"
                onClick={() => handleSortToggle("total")}
              >
                <span>Итог</span>
                {sortField === "total" ? (
                  <AppIcon name={sortAsc ? "chevronUp" : "chevronDown"} size="xs" />
                ) : null}
              </th>
              <th className="payments-th-actions" />
            </tr>
          </thead>
          <tbody>
            {pagedVisits.map((visit) => {
              const isExpanded = expandedRowIds.has(visit.id);
              const debt = getVisitDebt(visit);
              const total = getVisitTransactionTotal(visit);
              const paymentIcon = getPaymentIcon(visit.payment);

              return (
                <tr
                  key={visit.id}
                  className={`payments-table-row ${isExpanded ? "is-expanded" : ""} ${visit.isPlanned ? "is-planned" : ""}`}
                >
                  <td colSpan={7} className="payments-row-cell-wrap">
                    <div
                      className="payments-row-main-line"
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => toggleRowExpanded(visit.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleRowExpanded(visit.id);
                        }
                      }}
                    >
                      <div className="payments-col-date">{visit.date}</div>
                      <div className="payments-col-client" title={visit.client}>
                        <span className="payments-client-name">{visit.client || "Без имени"}</span>
                      </div>
                      <div className="payments-col-service" title={visit.service}>
                        <span className="payments-service-name">{visit.service || "Услуга"}</span>
                        {visit.isPlanned ? (
                          <Badge className="payments-planned-badge" variant="success">
                            Запланирован
                          </Badge>
                        ) : null}
                      </div>
                      <div className="payments-col-master">{visit.master || "—"}</div>
                      <div className="payments-col-payment">
                        <span className="payments-method-badge">
                          <AppIcon name={paymentIcon} size="xs" />
                          <span>{visit.payment || "Не указано"}</span>
                        </span>
                      </div>
                      <div className="payments-col-total">
                        <span className="payments-total-amount">{formatMoney(total)}</span>
                        {debt > 0 ? (
                          <span className="payments-debt-badge" title="Сумма долга">
                            Долг: {formatMoney(debt)}
                          </span>
                        ) : null}
                      </div>
                      <div
                        className="payments-col-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconButton
                          aria-label={isExpanded ? "Свернуть подробности" : "Раскрыть подробности"}
                          className="payments-expand-btn"
                          icon={isExpanded ? "chevronUp" : "chevronDown"}
                          size="xs"
                          variant="ghost"
                          onClick={() => toggleRowExpanded(visit.id)}
                        />
                        <RowActionsMenu
                          className="payments-row-menu"
                          itemId={visit.id}
                          openMenuId={openActionMenuId}
                          setOpenMenuId={onToggleActionMenu}
                          onDelete={onDeleteVisit ? () => onDeleteVisit(visit) : undefined}
                          onEdit={onEditVisit ? () => onEditVisit(visit) : undefined}
                        />
                      </div>
                    </div>

                    {/* Expandable detail card */}
                    {isExpanded ? (
                      <div className="payments-detail-panel">
                        <div className="payments-detail-grid">
                          <div className="payments-detail-item">
                            <span className="payments-detail-label">Стоимость</span>
                            <strong className="payments-detail-val">{formatMoney(visit.amount)}</strong>
                          </div>
                          <div className="payments-detail-item">
                            <span className="payments-detail-label">Скидка</span>
                            <strong className="payments-detail-val">
                              {Number(visit.discount) > 0 ? `${visit.discount}%` : "0%"}
                            </strong>
                          </div>
                          <div className="payments-detail-item">
                            <span className="payments-detail-label">Комиссия</span>
                            <strong className="payments-detail-val">
                              {formatMoney(getVisitCommission(visit))}
                            </strong>
                          </div>
                          <div className="payments-detail-item">
                            <span className="payments-detail-label">Чаевые</span>
                            <strong className="payments-detail-val">{formatMoney(visit.tip)}</strong>
                          </div>
                          <div className="payments-detail-item">
                            <span className="payments-detail-label">Доп. сумма</span>
                            <strong className="payments-detail-val">{formatMoney(visit.extra)}</strong>
                          </div>
                          <div className="payments-detail-item">
                            <span className="payments-detail-label">Долг</span>
                            <strong className={`payments-detail-val ${debt > 0 ? "is-debt" : ""}`}>
                              {formatMoney(debt)}
                            </strong>
                          </div>
                        </div>
                        {visit.note ? (
                          <div className="payments-detail-note">
                            <span>Заметка:</span> {visit.note}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {!filteredVisits.length ? (
              <tr>
                <td colSpan={7} className="payments-empty-cell">
                  <div className="payments-empty-state">
                    <strong>Ничего не найдено</strong>
                    <span>Попробуйте изменить строку поиска или параметры фильтрации.</span>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* 3. Pagination Footer */}
      <PaginationBar
        autoPageSize={autoPageSize}
        className="shrink-0"
        currentPage={safeCurrentPage}
        itemLabel="записей"
        pageSize={pageSize}
        totalItems={filteredVisits.length}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

export default VisitsTable;
