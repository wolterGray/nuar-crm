import {useEffect, useMemo, useRef, useState} from "react";
import VisitsTable from "../VisitsTable.jsx";
import DayClosePanel from "../DayClosePanel.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {buildFinancialQualityReport} from "../../utils/financialQuality.js";
import {exportVisitsToCsv} from "../../utils/paymentJournal.js";
import {PageNotificationsSlot} from "../PageNotifications.jsx";
import HintIcon from "../HintIcon.jsx";
import {Button} from "../ui/index.js";

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

function FinancialQualityPanel({focused = false, panelRef, report, onOpenIssue}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const issues = Array.isArray(report?.issues) ? report.issues : [];
  const filteredIssues =
    activeFilter === "all"
      ? issues
      : issues.filter((issue) => issue.type === activeFilter);
  const issueCounts = issues.reduce(
    (counts, issue) => ({
      ...counts,
      [issue.type]: (counts[issue.type] ?? 0) + 1,
    }),
    {all: issues.length},
  );
  const visibleFilters = ISSUE_FILTERS.filter(
    (filter) =>
      filter.id === "all" || issues.some((issue) => issue.type === filter.id),
  );

  if (report?.ok) {
    return (
      <section className="financial-quality-panel is-ok payments-quality-panel" aria-label="Проверка денег">
        <div className="payments-quality-ok-content">
          <div className="payments-quality-ok-badge">✓</div>
          <div>
            <span className="payments-quality-badge-label">Проверка денег</span>
            <strong className="payments-quality-title">Ошибок не найдено</strong>
            <small className="payments-quality-desc">
              Завершённые визиты, начисления, пакеты и сертификаты полностью совпадают.
            </small>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={panelRef}
      className={`financial-quality-panel payments-quality-panel ${focused ? "alert-focus-pulse" : ""}`}
      aria-label="Проверка денег"
    >
      <header className="financial-quality-header payments-quality-header">
        <div>
          <span className="payments-quality-badge-label">Проверка денег</span>
          <strong className="payments-quality-title">
            {report?.criticalCount ?? issues.length} срочных ошибок
          </strong>
          <small className="payments-quality-desc">
            Проверьте несоответствия перед выплатами мастерам и закрытием смены.
          </small>
        </div>
      </header>

      <div className="financial-quality-filters payments-quality-filters" role="tablist" aria-label="Фильтр ошибок">
        {visibleFilters.map((filter) => (
          <button
            type="button"
            key={filter.id}
            className={`payments-quality-filter-btn ${activeFilter === filter.id ? "is-active" : ""}`}
            onClick={() => setActiveFilter(filter.id)}
          >
            <span>{filter.label}</span>
            <span className="payments-quality-filter-count">{issueCounts[filter.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="financial-quality-list payments-quality-list">
        {filteredIssues.map((issue) => (
          <article className="financial-quality-row payments-quality-row" key={issue.id}>
            <div className="payments-quality-row-info">
              <span className="payments-quality-tone-badge">
                {ISSUE_TONE[issue.type] ?? "Проверка"}
              </span>
              <strong className="payments-quality-row-title">{issue.title}</strong>
              <small className="payments-quality-row-desc">{issue.message}</small>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onOpenIssue?.(issue)}
            >
              Календарь
            </Button>
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
  qualityFocusToken,
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
  const [activeTab, setActiveTab] = useState("journal");
  const [prevFocusToken, setPrevFocusToken] = useState(qualityFocusToken);
  const qualityPanelRef = useRef(null);
  const [qualityPanelFocused, setQualityPanelFocused] = useState(false);

  if (qualityFocusToken !== prevFocusToken) {
    setPrevFocusToken(qualityFocusToken);
    if (qualityFocusToken) {
      setActiveTab("quality");
    }
  }

  const financialQualityReport = useMemo(
    () =>
      buildFinancialQualityReport({
        calendarEntries,
        completedVisits,
      }),
    [calendarEntries, completedVisits],
  );

  const issueCount =
    financialQualityReport?.criticalCount ?? financialQualityReport?.issues?.length ?? 0;

  useEffect(() => {
    if (!qualityFocusToken) return undefined;

    const setupTimer = window.setTimeout(() => {
      qualityPanelRef.current?.scrollIntoView({behavior: "smooth", block: "center"});
      setQualityPanelFocused(true);
    }, 80);
    const clearTimer = window.setTimeout(() => {
      setQualityPanelFocused(false);
    }, 3800);

    return () => {
      window.clearTimeout(setupTimer);
      window.clearTimeout(clearTimer);
    };
  }, [qualityFocusToken]);

  return (
    <section className={`payments-page nuar-payments ${isMobile ? "payments-page-mobile" : ""}`}>
      {/* 1. Top Title Bar */}
      <div className="payments-top-bar">
        <div className="payments-top-title-wrap">
          <h1 className="payments-top-title">Оплаты</h1>
          <HintIcon>Управление платежами, закрытие смены и проверка финансовых несоответствий.</HintIcon>
        </div>
        <div className="payments-top-actions">
          <PageNotificationsSlot />
        </div>
      </div>

      {/* 2. Tabs and Actions Bar */}
      <div className="payments-tabs-action-bar">
        <div className="payments-tabs-nav" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "journal"}
            className={`payments-tab-btn ${activeTab === "journal" ? "is-active" : ""}`}
            onClick={() => setActiveTab("journal")}
          >
            <span>Журнал</span>
            {activeTab === "journal" ? <span className="payments-tab-underline" /> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "dayClose"}
            className={`payments-tab-btn ${activeTab === "dayClose" ? "is-active" : ""}`}
            onClick={() => setActiveTab("dayClose")}
          >
            <span>Закрытие дня</span>
            {activeTab === "dayClose" ? <span className="payments-tab-underline" /> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "quality"}
            className={`payments-tab-btn ${activeTab === "quality" ? "is-active" : ""}`}
            onClick={() => setActiveTab("quality")}
          >
            <span>Проверка денег</span>
            {issueCount > 0 ? (
              <span className="payments-tab-badge">{issueCount}</span>
            ) : null}
            {activeTab === "quality" ? <span className="payments-tab-underline" /> : null}
          </button>
        </div>

        <div className="payments-tabs-actions">
          <Button
            leftIcon="download"
            size="sm"
            variant="secondary"
            onClick={() => exportVisitsToCsv(visits)}
          >
            Экспорт CSV
          </Button>
          <Button
            className="payments-add-payment-cta"
            leftIcon="plus"
            size="sm"
            variant="primary"
            onClick={onAddPayment}
          >
            Добавить поступление
          </Button>
        </div>
      </div>

      {/* 3. Active Tab Content */}
      <div className="payments-tab-content">
        {activeTab === "journal" ? (
          <VisitsTable
            clientProfiles={clientProfiles}
            filters={filters}
            masters={masters}
            openActionMenuId={openActionMenuId}
            visits={visits}
            onDeleteVisit={onDeleteVisit}
            onEditVisit={onEditVisit}
            onFilterChange={onFilterChange}
            onResetFilters={onResetFilters}
            onToggleActionMenu={onToggleActionMenu}
          />
        ) : null}

        {activeTab === "dayClose" ? (
          <DayClosePanel
            inTab={true}
            dayCloseRecords={dayCloseRecords}
            getJournalForDate={getDayCloseJournal}
            onCloseDay={closeDay}
            onReopenDayClose={reopenDayClose}
            onRemoveDayClose={removeDayClose}
          />
        ) : null}

        {activeTab === "quality" ? (
          <FinancialQualityPanel
            focused={qualityPanelFocused}
            panelRef={qualityPanelRef}
            report={financialQualityReport}
            onOpenIssue={onOpenCalendarIssue}
          />
        ) : null}
      </div>
    </section>
  );
}

export default PaymentsPage;
