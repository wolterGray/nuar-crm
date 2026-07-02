export default function AppShell({
  afterMain,
  children,
  compactMode,
  contentRef,
  isCalendarPage,
  isClientsPage,
  isEmployeesPage,
  isImportPage,
  isOperationsPage,
  isPackagesPage,
  isPaymentsPage,
  isServicesPage,
  isSettingsPage,
  isSitePage,
  isStatisticsPage,
  isTemplatesPage,
  isTodayPage,
  navigation,
  pullRefresh,
  theme,
  onShellClick,
  onTouchCancel,
  onTouchEnd,
  onTouchMove,
  onTouchStart,
}) {
  const shellClasses = [
    "crm-shell",
    "grid md:grid-cols-[240px_1fr] w-screen h-screen overflow-hidden",
    `theme-${theme}`,
    compactMode ? "compact-mode" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const contentClasses = [
    "content",
    isTodayPage ? "home-content today-content" : "",
    isCalendarPage ? "calendar-content" : "",
    isClientsPage ? "clients-content" : "",
    isOperationsPage ? "operations-content" : "",
    isPaymentsPage ? "visits-content payments-content" : "",
    isServicesPage ? "services-content" : "",
    isPackagesPage ? "packages-content" : "",
    isEmployeesPage ? "employees-content" : "",
    isTemplatesPage ? "templates-content" : "",
    isImportPage ? "import-content" : "",
    isStatisticsPage ? "statistics-content" : "",
    isSitePage ? "site-content" : "",
    isSettingsPage ? "settings-content" : "",
    "flex-1 min-w-0 min-h-0 bg-[#0B0F14] text-zinc-150 p-4 md:p-6 pb-20 md:pb-6 overflow-y-auto overscroll-contain",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={shellClasses}
      onClick={onShellClick}
    >
      {navigation}

      {/* Pull to refresh indicator */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 h-12 bg-zinc-950/80 border-b border-zinc-800/50 text-zinc-300 text-xs font-semibold backdrop-blur-xs transition-transform duration-200 ease-out select-none pointer-events-none transform translate-y-[-100%]"
        style={{ transform: pullRefresh.refreshing ? "translateY(0)" : `translateY(calc(-100% + ${Math.min(pullRefresh.distance, 48)}px))` }}
      >
        <span className={`w-2.5 h-2.5 rounded-full bg-indigo-500 ${pullRefresh.refreshing ? "animate-ping" : ""}`} aria-hidden="true" />
        <span>{pullRefresh.refreshing ? "Обновляем..." : "Потяните для обновления"}</span>
      </div>

      <main
        ref={contentRef}
        className={contentClasses}
        onTouchCancel={onTouchCancel}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        onTouchStart={onTouchStart}
      >
        {children}
      </main>
      {afterMain}
    </div>
  );
}
