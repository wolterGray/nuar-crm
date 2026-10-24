import {MobileLayout, MobilePageContainer} from "./MobileLayout.jsx";
import AppIcon from "./ui/AppIcon.jsx";

export default function AppShell({
  afterMain,
  children,
  compactMode,
  contentRef,
  isCalendarPage,
  isClientsPage,
  isClubPage,
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
  const pageName =
    (isTodayPage && "today") ||
    (isCalendarPage && "calendar") ||
    (isClientsPage && "clients") ||
    (isClubPage && "club") ||
    (isOperationsPage && "operations") ||
    (isPaymentsPage && "payments") ||
    (isServicesPage && "services") ||
    (isPackagesPage && "packages") ||
    (isEmployeesPage && "employees") ||
    (isTemplatesPage && "templates") ||
    (isImportPage && "import") ||
    (isStatisticsPage && "statistics") ||
    (isSitePage && "site") ||
    (isSettingsPage && "settings") ||
    "default";
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
    isClubPage ? "club-content" : "",
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
    pullRefresh.pulling ? "is-pull-tracking" : "",
    pullRefresh.refreshing ? "is-pull-refreshing" : "",
    "app-shell-content flex-1 min-w-0 min-h-0 p-4 md:p-6 pb-20 md:pb-6 overflow-y-auto overscroll-contain",
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
        aria-live="polite"
        className={`app-pull-refresh ${pullRefresh.distance > 0 || pullRefresh.refreshing ? "is-visible" : ""} ${pullRefresh.ready ? "is-ready" : ""} ${pullRefresh.refreshing ? "is-refreshing" : ""}`}
        role="status"
        style={{
          "--pull-distance": `${pullRefresh.distance}px`,
          "--pull-progress": pullRefresh.progress,
        }}
      >
        <span className="app-pull-refresh-icon" aria-hidden="true">
          <AppIcon name="refresh" size="sm" />
        </span>
        <span>
          {pullRefresh.refreshing
            ? "Обновляем..."
            : pullRefresh.ready
              ? "Отпустите, чтобы обновить"
              : "Потяните для обновления"}
        </span>
      </div>

      <main
        ref={contentRef}
        className={contentClasses}
        onTouchCancel={onTouchCancel}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        onTouchStart={onTouchStart}
        style={{"--pull-distance": `${pullRefresh.distance}px`}}
      >
        <MobileLayout page={pageName}>
          <MobilePageContainer page={pageName}>
            {children}
          </MobilePageContainer>
        </MobileLayout>
      </main>
      {afterMain}
    </div>
  );
}
