export default function AppShell({
  afterMain,
  children,
  compactMode,
  contentRef,
  isCalendarPage,
  isClientsPage,
  isOperationsPage,
  isPaymentsPage,
  isServicesPage,
  isPackagesPage,
  isEmployeesPage,
  isImportPage,
  isSettingsPage,
  isSitePage,
  isStatisticsPage,
  isTemplatesPage,
  isTodayPage,
  navigation,
  pullRefresh,
  sidebarVisible,
  theme,
  onShellClick,
  onTouchCancel,
  onTouchEnd,
  onTouchMove,
  onTouchStart,
}) {
  return (
    <div
      className={`crm-shell notion-linear-redesign theme-${theme} ${
        sidebarVisible ? "" : "sidebar-hidden"
      } ${compactMode ? "compact-mode" : ""}`}
      onClick={onShellClick}>
      {navigation}
      <div
        className={`pull-refresh-indicator ${
          pullRefresh.refreshing || pullRefresh.distance > 0 ? "visible" : ""
        } ${pullRefresh.refreshing ? "refreshing" : ""}`}
        style={{"--pull-distance": `${pullRefresh.distance}px`}}>
        <span aria-hidden="true" />
        <b>{pullRefresh.refreshing ? "Обновляем" : "Потяните для обновления"}</b>
      </div>

      <main
        ref={contentRef}
        className={`content home-content ${isCalendarPage ? "calendar-content" : ""} ${
          isClientsPage ? "clients-content" : ""
        } ${isOperationsPage ? "operations-content" : ""} ${
          isPaymentsPage ? "visits-content payments-content" : ""
        } ${isServicesPage ? "services-content" : ""} ${
          isPackagesPage ? "packages-content" : ""
        } ${isEmployeesPage ? "employees-content" : ""} ${
          isTemplatesPage ? "templates-content" : ""
        } ${isImportPage ? "import-content" : ""} ${
          isStatisticsPage ? "statistics-content" : ""
        } ${isSitePage ? "site-content" : ""} ${
          isSettingsPage ? "settings-content" : ""
        } ${isTodayPage ? "today-content" : ""}`}
        onTouchCancel={onTouchCancel}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        onTouchStart={onTouchStart}>
        {children}
      </main>
      {afterMain}
    </div>
  );
}
