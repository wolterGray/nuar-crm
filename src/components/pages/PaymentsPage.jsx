import VisitsTable from "../VisitsTable.jsx";

function PaymentsPage({
  filters,
  masters,
  openActionMenuId,
  visits,
  onAddPayment,
  onDeleteVisit,
  onFilterChange,
  onResetFilters,
  onToggleActionMenu,
}) {
  return (
    <section className="payments-page">
      <VisitsTable
        addLabel="Добавить поступление"
        filters={filters}
        masters={masters}
        openActionMenuId={openActionMenuId}
        title="Оплаты и финансовый журнал"
        visits={visits}
        onAddVisit={onAddPayment}
        onDeleteVisit={onDeleteVisit}
        onFilterChange={onFilterChange}
        onResetFilters={onResetFilters}
        onToggleActionMenu={onToggleActionMenu}
      />
    </section>
  );
}

export default PaymentsPage;
