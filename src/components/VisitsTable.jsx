import {Download, ListFilter, MoreVertical, Plus} from "lucide-react";
import {paymentMethods} from "../data/seed.js";
import {formatMoney} from "../utils/formatters.jsx";
import {getVisitCommission, getVisitTransactionTotal} from "../utils/visits.jsx";
import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {PageNotificationsSlot} from "./PageNotifications.jsx";

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
  const clientOptions = [...new Set(visits.map((visit) => visit.client))];
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
    link.download = `nuar-visits-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="panel visits-panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <div className="visits-panel-actions">
          <button className="secondary-button" type="button" onClick={exportVisits}>
            <Download size={17} />
            Экспорт CSV
          </button>
          <button className="secondary-button" onClick={onResetFilters}>
            <ListFilter size={17} />
            Сбросить
          </button>
          {onAddVisit && (
            <button className="add-visit-button" type="button" onClick={onAddVisit}>
              <Plus size={17} />
              {addLabel}
            </button>
          )}
          <PageNotificationsSlot />
        </div>
      </div>

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

      <div className="visits-table">
        <div className="table-row table-head">
          <span>Дата</span>
          <span>Клиент</span>
          <span>Услуга</span>
          <span>Работник</span>
          <span>Стоимость</span>
          <span>Оплата</span>
          <span>Чай</span>
          <span>Комиссия</span>
          <span>Доп сумма</span>
          <span>Скидка</span>
          <span>Итог</span>
          <span></span>
        </div>
        {visits.map((visit) => (
          <div className={`table-row ${visit.isPlanned ? "table-row-planned" : ""}`} key={visit.id}>
            <span>{visit.date}</span>
            <TooltipCell value={visit.client} />
            <span>
              {visit.service}
              {visit.isPlanned && <small>Запланирован</small>}
            </span>
            <span>{visit.master}</span>
            <span>{formatMoney(visit.amount)}</span>
            <TooltipCell
              className={String(visit.payment ?? "").includes("Пакет") ? "package" : ""}
              value={visit.payment || "Не указано"}
              tooltip={
                visit.packageName
                  ? `${visit.packageName}: списано ${visit.packageSessionsUsed || 1}`
                  : visit.payment || "Не указано"
              }
            />
            <span>{formatMoney(visit.tip)}</span>
            <TooltipCell
              value={formatMoney(getVisitCommission(visit))}
              tooltip={visit.commissionType ?? "Без комиссии"}
            />
            <span>{formatMoney(visit.extra)}</span>
            <span>{Number(visit.discount) || 0}%</span>
            <span className="total-cell">
              {formatMoney(getVisitTransactionTotal(visit))}
            </span>
            <div
              className="row-actions"
              onClick={(event) => event.stopPropagation()}>
              <button
                className="row-action"
                aria-label="Действия"
                onClick={() =>
                  onToggleActionMenu(
                    openActionMenuId === visit.id ? null : visit.id,
                  )
                }>
                <MoreVertical size={18} />
              </button>
              {openActionMenuId === visit.id && (
                <div className="row-action-menu">
                  {onEditVisit && (
                    <button type="button" onClick={() => onEditVisit(visit)}>
                      Редактировать
                    </button>
                  )}
                  {onDeleteVisit && (
                    <button type="button" onClick={() => onDeleteVisit(visit)}>
                      Удалить
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <footer className="table-footer">
        <span>Визитов: {visits.length}</span>
      </footer>
    </section>
  );
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
