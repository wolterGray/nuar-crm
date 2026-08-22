import {AnimatePresence, motion, useReducedMotion} from "framer-motion";
import {MobileLayout, MobilePageContainer} from "./MobileLayout.jsx";

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
  const shouldReduceMotion = useReducedMotion();
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
        className="app-pull-refresh fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 h-12 text-xs font-semibold backdrop-blur-xs transition-transform duration-200 ease-out select-none pointer-events-none transform translate-y-[-100%]"
        style={{ transform: pullRefresh.refreshing ? "translateY(0)" : `translateY(calc(-100% + ${Math.min(pullRefresh.distance, 48)}px))` }}
      >
        <span className={`app-pull-refresh-dot w-2.5 h-2.5 rounded-full ${pullRefresh.refreshing ? "animate-ping" : ""}`} aria-hidden="true" />
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
        <MobileLayout page={pageName}>
          <MobilePageContainer page={pageName}>
            <AnimatePresence initial={false} mode="wait">
              <motion.div
                animate={shouldReduceMotion ? {opacity: 1} : {opacity: 1, scale: 1, y: 0}}
                className="app-page-motion"
                exit={shouldReduceMotion ? {opacity: 0} : {opacity: 0, scale: 0.985, y: -4}}
                initial={shouldReduceMotion ? {opacity: 0} : {opacity: 0, scale: 0.992, y: 8}}
                key={pageName}
                transition={{
                  damping: 28,
                  duration: shouldReduceMotion ? 0.08 : undefined,
                  mass: 0.8,
                  stiffness: 360,
                  type: "spring",
                }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </MobilePageContainer>
        </MobileLayout>
      </main>
      {afterMain}
    </div>
  );
}
