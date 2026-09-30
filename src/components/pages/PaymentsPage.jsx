import {useMemo, useState} from "react";
import VisitsTable from "../VisitsTable.jsx";
import DayClosePanel from "../DayClosePanel.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {buildFinancialQualityReport} from "../../utils/financialQuality.js";

const ISSUE_FILTERS = [
  {id: "all", label: "Все"},
  {id: "missing_paired_earning", label: "Парные"},
  {id: "missing_earning", label: "Начисления"},
  {id: "missing_completed_visit", label: "Фин. визиты"},
  {id: "missing_package_link", label: "Пакеты"},
  {id: "missing_certificate_link", label: "Сертификаты"},
];

const ISSUE_TONE = {
  missing_certificate_link: "Сертификат",
  missing_completed_visit: "Финансы",
  missing_earning: "Начисление",
  missing_package_link: "Пакет",
  missing_paired_earning: "Парный",
};

function FinancialQualityPanel({report, onOpenIssue}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const issues = Array.isArray(report?.issues) ? report.issues : [];
  const filteredIssues =
    activeFilter === "all"
      ? issues
      : issues.filter((issue) => issue.type === activeFilter);
  const visibleFilters = ISSUE_FILTERS.filter(
    (filter) =>
      filter.id === "all" || issues.some((issue) => issue.type === filter.id),
  );

  if (report?.ok) {
    return (
      <section className="financial-quality-panel is-ok" aria-label="Проверка денег">
        <div>
          <span>Проверка денег</span>
          <strong>Ошибок не найдено</strong>
        </div>
        <small>Завершённые визиты, начисления, пакеты и сертификаты совпадают.</small>
      </section>
    );
  }

  return (
    <section className="financial-quality-panel" aria-label="Проверка денег">
      <header className="financial-quality-header">
        <div>
          <span>Проверка денег</span>
          <strong>{report?.criticalCount ?? issues.length} срочных ошибок</strong>
        </div>
        <small>Проверьте перед выплатами и закрытием дня.</small>
      </header>

      <div className="financial-quality-filters" role="tablist" aria-label="Фильтр ошибок">
        {visibleFilters.map((filter) => (
          <button
            type="button"
            key={filter.id}
            className={activeFilter === filter.id ? "is-active" : ""}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="financial-quality-list">
        {filteredIssues.map((issue) => (
          <article className="financial-quality-row" key={issue.id}>
            <div>
              <span>{ISSUE_TONE[issue.type] ?? "Проверка"}</span>
              <strong>{issue.title}</strong>
              <small>{issue.message}</small>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onOpenIssue?.(issue)}
            >
              Календарь
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function PaymentsPage({
  calendarEntries,
  clientProfiles,
  closeDay,
  completedVisits,
  dayCloseRecords,
  filters,
  getDayCloseJournal,
  masters,
  openActionMenuId,
  reopenDayClose,
  removeDayClose,
  visits,
  onAddPayment,
  onDeleteVisit,
  onEditVisit,
  onFilterChange,
  onOpenCalendarIssue,
  onResetFilters,
  onToggleActionMenu,
}) {
  const {isMobile} = useBreakpoint();
  const financialQualityReport = useMemo(
    () =>
      buildFinancialQualityReport({
        calendarEntries,
        completedVisits,
      }),
    [calendarEntries, completedVisits],
  );

  return (
    <section className={`payments-page nuar-payments ${isMobile ? "payments-page-mobile" : ""}`}>
      <FinancialQualityPanel
        report={financialQualityReport}
        onOpenIssue={onOpenCalendarIssue}
      />
      {!isMobile ? (
        <DayClosePanel
          dayCloseRecords={dayCloseRecords}
          getJournalForDate={getDayCloseJournal}
          onCloseDay={closeDay}
          onReopenDayClose={reopenDayClose}
          onRemoveDayClose={removeDayClose}
        />
      ) : null}
      <VisitsTable
        clientProfiles={clientProfiles}
        addLabel="Добавить поступление"
        filters={filters}
        masters={masters}
        openActionMenuId={openActionMenuId}
        title="Оплаты и финансовый журнал"
        visits={visits}
        onAddVisit={onAddPayment}
        onDeleteVisit={onDeleteVisit}
        onEditVisit={onEditVisit}
        onFilterChange={onFilterChange}
        onResetFilters={onResetFilters}
        onToggleActionMenu={onToggleActionMenu}
      />
    </section>
  );
}

export default PaymentsPage;
