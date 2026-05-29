import {ListFilter, MoreVertical} from "lucide-react";
import {paymentMethods} from "../data/seed.js";
import {formatMoney} from "../utils/formatters.jsx";
import {getVisitTotal} from "../utils/visits.jsx";

function VisitsTable({
  visits,
  title,
  masters,
  filters,
  onFilterChange,
  onResetFilters,
  openActionMenuId,
  onToggleActionMenu,
  onEditVisit,
  onDeleteVisit,
}) {
  const clientCount = new Set(visits.map((visit) => visit.client)).size;
  const clientOptions = [...new Set(visits.map((visit) => visit.client))];

  return (
    <section className="panel visits-panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <button className="secondary-button" onClick={onResetFilters}>
          <ListFilter size={17} />
          Сбросить
        </button>
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
          <select
            value={filters.client}
            onChange={(event) => onFilterChange("client", event.target.value)}>
            <option value="">Все</option>
            {clientOptions.map((client) => (
              <option key={client}>{client}</option>
            ))}
          </select>
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
          <span>Оплата</span>
          <span>Чай</span>
          <span>Комиссия</span>
          <span>Доп сумма</span>
          <span>Скидка</span>
          <span>Итог</span>
          <span></span>
        </div>
        {visits.map((visit) => (
          <div className="table-row" key={visit.id}>
            <span>{visit.date}</span>
            <TooltipCell value={visit.client} />
            <span>{visit.service}</span>
            <span>{visit.master}</span>
            <TooltipCell
              className={visit.payment.includes("Пакет") ? "package" : ""}
              value={visit.payment}
            />
            <span>{formatMoney(visit.tip)}</span>
            <span>{formatMoney(visit.commission)}</span>
            <span>{formatMoney(visit.extra)}</span>
            <span>{formatMoney(visit.discount)}</span>
            <span className="total-cell">
              {formatMoney(getVisitTotal(visit))}
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
                  <button type="button" onClick={() => onEditVisit(visit)}>
                    Редактировать
                  </button>
                  <button type="button" onClick={() => onDeleteVisit(visit)}>
                    Удалить
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <footer className="table-footer">
        <span>Клиентов: {clientCount}</span>
      </footer>
    </section>
  );
}
function TooltipCell({value, className = ""}) {
  return (
    <span className={`tooltip-cell ${className}`} tabIndex="0">
      <span className="cell-value">{value}</span>
      <span className="cell-tooltip" role="tooltip">
        {value}
      </span>
    </span>
  );
}

export default VisitsTable;
