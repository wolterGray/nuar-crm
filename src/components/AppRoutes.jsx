import {lazy, Suspense} from "react";
import ForbiddenScreen from "./ForbiddenScreen.jsx";
import {
  PERMISSIONS,
  canPerform,
  canViewPage,
  getDefaultPageForUser,
  hasPermission,
} from "../utils/permissions.js";

const routeLoaders = {
  today: () => import("./pages/TodayPage.jsx"),
  calendar: () => import("./pages/CalendarPage.jsx"),
  clients: () => import("./pages/ClientsPage.jsx"),
  club: () => import("./pages/ClubPage.jsx"),
  services: () => import("./pages/ServicesPage.jsx"),
  packages: () => import("./pages/PackagesPage.jsx"),
  masters: () => import("./EmployeesPage.jsx"),
  templates: () => import("./pages/MessageTemplatesPage.jsx"),
  operations: () => import("./pages/OperationsPage.jsx"),
  "task-editor": () => import("./pages/TaskEditorPage.jsx"),
  import: () => import("./pages/ImportPage.jsx"),
  payments: () => import("./pages/PaymentsPage.jsx"),
  "my-earnings": () => import("./pages/MyEarningsPage.jsx"),
  statistics: () => import("./pages/StatisticsPage.jsx"),
  site: () => import("./pages/SitePage.jsx"),
  settings: () => import("./pages/SettingsPage.jsx"),
};

export function preloadAppRoute(activePage) {
  const loader = routeLoaders[activePage] ?? routeLoaders.calendar;
  return loader();
}

const TodayPage = lazy(routeLoaders.today);
const CalendarPage = lazy(routeLoaders.calendar);
const ClientsPage = lazy(routeLoaders.clients);
const ClubPage = lazy(routeLoaders.club);
const ServicesPage = lazy(routeLoaders.services);
const PackagesPage = lazy(routeLoaders.packages);
const EmployeesPage = lazy(routeLoaders.masters);
const MessageTemplatesPage = lazy(routeLoaders.templates);
const OperationsPage = lazy(routeLoaders.operations);
const TaskEditorPage = lazy(routeLoaders["task-editor"]);
const ImportPage = lazy(routeLoaders.import);
const PaymentsPage = lazy(routeLoaders.payments);
const MyEarningsPage = lazy(routeLoaders["my-earnings"]);
const StatisticsPage = lazy(routeLoaders.statistics);
const SitePage = lazy(routeLoaders.site);
const SettingsPage = lazy(routeLoaders.settings);

function SectionLoadingFallback() {
  return (
    <div className="section-loading-fallback" aria-live="polite" aria-busy="true">
      <span className="section-loading-spinner" aria-hidden="true" />
      <span className="section-loading-label">Загружаем раздел</span>
    </div>
  );
}

function PageSuspense({children}) {
  return (
    <Suspense fallback={<SectionLoadingFallback />}>
      {children}
    </Suspense>
  );
}

export default function AppRoutes({activePage, authUser = null, ...props}) {
  const user = authUser || props.authUser || null;
  const privateCalendarEntries = (props.calendarEntries ?? []).filter(
    (entry) => entry.restricted !== true,
  );

  // Enforce access control: if user is not authorized to view the requested page, show ForbiddenScreen
  if (user && !canViewPage(activePage, user)) {
    return (
      <ForbiddenScreen
        pageName={`разделу "${activePage}"`}
        onNavigate={() => props.setActivePage?.(getDefaultPageForUser(user))}
      />
    );
  }

  switch (activePage) {
    case "today":
      return (
        <PageSuspense>
          <TodayPage
            alertSummary={props.alertSummary}
            alerts={props.alerts}
            appSettings={props.appSettings}
            calendarEntries={privateCalendarEntries}
            certificates={props.certificates}
            clientPackages={props.clientPackages}
            clientProfiles={props.clientProfiles}
            employees={props.activeEmployees}
            completedVisits={props.visits}
            supplies={props.supplies}
            tasks={props.tasks}
            visits={props.paymentRows}
            onAddTask={props.openCreateTask}
            onAddVisit={props.openCreateCalendarEntry}
            onChangeSupplyStock={props.changeSupplyStock}
            onCompleteTask={props.completeTask}
            onEditVisit={(entry) => props.requestCalendarAction("edit", entry)}
            onOpenCalendar={() => props.setActivePage("calendar")}
            onOpenClients={() => props.setActivePage("clients")}
            onOpenOperations={() => props.setActivePage("operations")}
            onOpenPayments={() => props.setActivePage("payments")}
            onRemindVisit={props.remindCalendarClient}
          />
        </PageSuspense>
      );

    case "calendar":
      return (
        <PageSuspense>
          <CalendarPage
            alertFocus={props.alertFocus}
            canManageAll={hasPermission(user, PERMISSIONS.CALENDAR_MANAGE_ALL)}
            entries={props.calendarEntriesWithServiceColors}
            visits={props.visits}
            clients={props.clientProfiles}
            clientPackages={props.clientPackages}
            employees={props.activeEmployees}
            ownEmployeeId={user?.employeeId}
            settings={props.appSettings}
            onAdd={props.openCreateCalendarEntry}
            onAlertFocusHandled={props.clearAlertFocus}
            onEdit={(entry) => props.requestCalendarAction("edit", entry)}
            onDelete={(entry) => props.requestCalendarAction("delete", entry)}
            onMove={props.moveCalendarEntry}
            onRemind={props.remindCalendarClient}
            onStatus={props.updateCalendarEntryStatus}
            overlayOpen={props.calendarEntryModalOpen}
          />
        </PageSuspense>
      );

    case "payments":
      return (
        <PageSuspense>
          <PaymentsPage
            calendarEntries={privateCalendarEntries}
            clientProfiles={props.clientProfiles}
            closeDay={props.closeDay}
            completedVisits={props.visits}
            dayCloseRecords={props.dayCloseRecords}
            filters={props.paymentFilters}
            getDayCloseJournal={props.getDayCloseJournal}
            masters={props.masters}
            openActionMenuId={props.openPaymentActionMenuId}
            qualityFocusToken={props.paymentQualityFocusToken}
            reopenDayClose={props.reopenDayClose}
            removeDayClose={props.removeDayClose}
            visits={props.filteredPaymentRows}
            canManageDayClose={hasPermission(user, PERMISSIONS.FINANCE_DAY_CLOSE)}
            canViewSalonStats={hasPermission(user, PERMISSIONS.FINANCE_VIEW_SALON_STATS)}
            canAddPayment={
              hasPermission(user, PERMISSIONS.FINANCE_DAY_CLOSE) ||
              hasPermission(user, PERMISSIONS.FINANCE_VIEW_SALON_STATS)
            }
            onAddPayment={props.openCreatePayment}
            onDeleteVisit={canPerform("delete", "visit", null, user) ? props.deletePaymentRow : null}
            onEditVisit={canPerform("edit", "visit", null, user) ? props.editPaymentRow : null}
            onFilterChange={props.onPaymentFilterChange}
            onOpenCalendarIssue={props.openCalendarIssue}
            onResetFilters={props.onPaymentFiltersReset}
            onToggleActionMenu={props.setOpenPaymentActionMenuId}
          />
        </PageSuspense>
      );

    case "my-earnings":
      return (
        <PageSuspense>
          <MyEarningsPage
            authUser={user}
            visits={props.paymentRows || props.visits}
            pushNotification={props.pushNotification}
          />
        </PageSuspense>
      );

    case "clients": {
      const canManageClients = canPerform("manage", "client", null, user);
      const canDeleteClients = canPerform("delete", "client", null, user);

      return (
        <PageSuspense>
          <ClientsPage
            alertFocus={props.alertFocus}
            visits={props.visits}
            calendarEntries={privateCalendarEntries}
            clients={props.clientProfiles}
            clientPackages={props.clientPackages}
            certificates={props.certificates}
            communicationLog={props.communicationLog}
            employees={props.employees}
            inactiveClientDays={props.inactiveClientDays}
            onAddClient={canManageClients ? props.openCreateClient : null}
            onAddVisit={props.openCreateCalendarEntry}
            onAlertFocusHandled={props.clearAlertFocus}
            appSettings={props.appSettings}
            onMessageClient={props.openClientMessageTemplates}
            onEditClient={canManageClients ? props.openEditClient : null}
            onUpdateClientNote={canManageClients ? props.updateClientNote : null}
            onDeleteClient={canDeleteClients ? props.requestDeleteClient : null}
          />
        </PageSuspense>
      );
    }

    case "club":
      return (
        <PageSuspense>
          <ClubPage
            clients={props.clientProfiles}
            pushNotification={props.pushNotification}
          />
        </PageSuspense>
      );

    case "services": {
      const canManageCatalog = canPerform("manage", "service", null, user);
      return (
        <PageSuspense>
          <ServicesPage
            services={props.serviceCatalog}
            serviceCategories={props.serviceCategories}
            employees={props.employees || props.activeEmployees}
            canManageCatalog={canManageCatalog}
            onSaveService={props.saveService}
            onDuplicateService={props.duplicateService}
            onToggleStatus={props.toggleServiceStatus}
            onAdd={props.openCreateService}
            onCreateCategory={props.createServiceCategory}
            onDeleteCategory={props.deleteServiceCategory}
            onEdit={props.openEditService}
            onDelete={props.requestDeleteService}
            onMoveServiceToCategory={props.moveServiceToCategory}
            onRenameCategory={props.renameServiceCategory}
            onReorder={props.reorderServices}
            appSettings={props.appSettings}
          />
        </PageSuspense>
      );
    }

    case "packages":
      return (
        <PageSuspense>
          <PackagesPage
            canManagePackages={hasPermission(user, PERMISSIONS.CATALOG_MANAGE)}
            canViewSalonStats={hasPermission(user, PERMISSIONS.FINANCE_VIEW_SALON_STATS)}
            packages={props.packagesCatalog}
            clientPackages={props.clientPackages}
            clientProfiles={props.clientProfiles ?? props.clients ?? []}
            clients={props.clients ?? props.clientProfiles ?? []}
            certificates={props.certificates}
            certificateSalesIncome={props.certificateSalesIncome}
            packageSalesIncome={props.packageSalesIncome}
            onAdd={props.openCreatePackage}
            onEdit={props.openEditPackage}
            onDelete={props.requestDeletePackage}
            onSellPackage={props.openCreateClientPackage}
            onSellCertificate={props.openCreateCertificate}
            onEditClientPackage={props.openEditClientPackage}
            onDeleteClientPackage={props.requestDeleteClientPackage}
            onEditCertificate={props.openEditCertificate}
            onDeleteCertificate={props.requestDeleteCertificate}
          />
        </PageSuspense>
      );

    case "masters":
      return (
        <PageSuspense>
          <EmployeesPage
            calendarEntries={privateCalendarEntries}
            completedVisits={props.visits}
            employees={props.employeeStats}
            getDailyPayrollReport={props.getDailyPayrollReport}
            getPayrollReport={props.getPayrollReport}
            markAllDailyPayoutsPaid={props.markAllDailyPayoutsPaid}
            markPayrollPaid={props.markPayrollPaid}
            payrollEmployees={props.payrollEmployees}
            payrollRecords={props.payrollRecords}
            removePayrollRecord={props.removePayrollRecord}
            reopenPayrollRecord={props.reopenPayrollRecord}
            setVisitMasterPayoutPaid={props.setVisitMasterPayoutPaid}
            pushNotification={props.pushNotification}
            onAdd={props.openCreateEmployee}
            onEdit={props.openEditEmployee}
            onDelete={props.requestDeleteEmployee}
            onOpenPayments={props.openPaymentQualityCheck}
          />
        </PageSuspense>
      );

    case "templates":
      return (
        <PageSuspense>
          <MessageTemplatesPage
            appSettings={props.appSettings}
            bulkSms={props.bulkSms}
            calendarEntries={props.calendarEntries}
            clients={props.clientProfiles}
            employees={props.employees}
            masters={props.masters}
            preferredClientId={props.preferredMessageClientId}
            setMessageTemplates={props.setMessageTemplates}
            templates={props.messageTemplates}
            onAdd={props.openCreateMessageTemplate}
            onClearPreferredClient={props.clearPreferredMessageClientId}
            onDelete={props.requestDeleteMessageTemplate}
            onEdit={props.openEditMessageTemplate}
            onMessageSent={props.logClientMessage}
            onNotify={props.pushNotification}
          />
        </PageSuspense>
      );

    case "operations":
      return (
        <PageSuspense>
          <><OperationsPage
            canManageTasks={hasPermission(user, PERMISSIONS.TASKS_MANAGE)}
            alertFocus={props.alertFocus}
            tasks={props.tasks}
            supplies={props.supplies}
            employees={props.employees}
            waitlistEntries={props.waitlistEntries}
            onAddTask={props.openCreateTask}
            onAddNote={props.addQuickNote}
            onUpdateNote={props.updateNote}
            onAddWaitlistEntry={props.openCreateWaitlistEntry}
            onAlertFocusHandled={props.clearAlertFocus}
            onBookWaitlistEntry={props.bookWaitlistEntryFromPanel}
            onCompleteTask={props.completeTask}
            onBulkDeleteTasks={props.deleteTaskTemplates}
            onDeleteTask={props.requestDeleteTask}
            onEditTask={props.openEditTask}
            onEditWaitlistEntry={props.openEditWaitlistEntry}
            onMessageWaitlistEntry={props.messageWaitlistEntryFromPanel}
            onMoveTask={props.moveTaskToDate}
            onTransferChecklistItem={props.transferChecklistItemToDate}
            onMoveTaskTemplateToArea={props.moveTaskTemplateToArea}
            onRenameTaskArea={props.renameTaskArea}
            onInitializeAcquisitionPlan={props.initializeAcquisitionPlan}
            onRemoveWaitlistEntry={props.removeWaitlistEntry}
            onRestoreWaitlistEntry={props.restoreWaitlistEntry}
            serviceCatalog={props.serviceCatalog}
            clientProfiles={props.clientProfiles}
            openClientMessageTemplates={props.openClientMessageTemplates}
            onReorderTasks={props.reorderTasks}
            onSetMainTask={props.setMainTask}
            onSaveTaskOccurrence={props.saveTaskOccurrence}
            onSetTaskTemplateArchived={props.setTaskTemplateArchived}
            onAddSupply={props.openCreateSupply}
            onEditSupply={props.openEditSupply}
            onDeleteSupply={props.requestDeleteSupply}
            onChangeSupplyStock={props.changeSupplyStock}
          />{props.taskModalOpen && props.editingTask?.type !== "note" ? <TaskEditorPage employees={props.activeEmployees} task={props.editingTask} onClose={props.closeTaskEditor} onDirtyChange={props.onTaskEditorDirtyChange} onSubmit={props.handleTaskSubmit} /> : null}</>
        </PageSuspense>
      );

    case "import":
      return (
        <PageSuspense>
          <ImportPage
            booksyGmailSync={props.booksyGmailSync}
            calendarEntries={props.calendarEntries}
            documents={props.importDocuments}
            onDeleteDocuments={props.deleteImportDocuments}
          />
        </PageSuspense>
      );

    case "statistics":
      return (
        <PageSuspense>
          <StatisticsPage
            authUser={user}
            canViewSalonStats={hasPermission(user, PERMISSIONS.FINANCE_VIEW_SALON_STATS)}
            visits={props.paymentRows}
            calendarEntries={privateCalendarEntries}
            certificates={props.certificates}
            clientPackages={props.clientPackages}
            clients={props.clientProfiles}
            employees={props.employees}
          />
        </PageSuspense>
      );

    case "site":
      return (
        <PageSuspense>
          <SitePage />
        </PageSuspense>
      );

    case "settings":
      return (
        <PageSuspense>
          <SettingsPage
            authUser={user}
            employees={props.employees}
            cloudConflict={props.cloudConflict}
            cloudEnabled={props.cloudEnabled}
            cloudHydrated={props.cloudHydrated}
            cloudLoadError={props.cloudLoadError}
            cloudSyncing={props.cloudSyncing}
            lastCloudSyncAt={props.lastCloudSyncAt}
            lastCloudSyncError={props.lastCloudSyncError}
            settings={props.appSettings}
            reviewRequests={props.reviewRequests}
            inactiveFollowUp={props.inactiveFollowUp}
            smsReminders={props.smsReminders}
            telegramDigest={props.telegramDigest}
            pushNotification={props.pushNotification}
            onApplyRemoteSnapshot={props.handleApplyRemoteSnapshot}
            onForceCloudSave={props.handleForceCloudSave}
            onOverwriteRemoteSnapshot={props.handleOverwriteRemoteSnapshot}
            onSubmit={props.handleSettingsSubmit}
            onReset={props.resetSettings}
            onExportData={props.exportDataBackup}
            onImportData={props.importDataBackup}
          />
        </PageSuspense>
      );

    default:
      if (canViewPage("statistics", user)) {
        return (
          <PageSuspense>
            <StatisticsPage
              visits={props.paymentRows}
              calendarEntries={props.calendarEntries}
              clientPackages={props.clientPackages}
              clients={props.clientProfiles}
              employees={props.employees}
            />
          </PageSuspense>
        );
      }

      return (
        <ForbiddenScreen
          pageName="запрошенной странице"
          onNavigate={() => props.setActivePage?.(getDefaultPageForUser(user))}
        />
      );
  }
}
