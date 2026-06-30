import VisitsTable from "../VisitsTable.jsx";
import DayClosePanel from "../DayClosePanel.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";

function PaymentsPage({
  closeDay,
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
  onResetFilters,
  onToggleActionMenu,
}) {
  const {isMobile} = useBreakpoint();

  return (
    <section className={`payments-page nuar-payments ${isMobile ? "payments-page-mobile" : ""}`}>
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
