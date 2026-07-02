import {lazy, Suspense} from "react";
import ServicesPage from "./pages/ServicesPage.jsx";
import PackagesPage from "./pages/PackagesPage.jsx";
import EmployeesPage from "./EmployeesPage.jsx";
import MessageTemplatesPage from "./pages/MessageTemplatesPage.jsx";
import ImportPage from "./pages/ImportPage.jsx";
import TodayPage from "./pages/TodayPage.jsx";
import SitePage from "./pages/SitePage.jsx";

const CalendarPage = lazy(() => import("./pages/CalendarPage.jsx"));
const ClientsPage = lazy(() => import("./pages/ClientsPage.jsx"));
const OperationsPage = lazy(() => import("./pages/OperationsPage.jsx"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage.jsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.jsx"));
const StatisticsPage = lazy(() => import("./pages/StatisticsPage.jsx"));

function PageSuspense({children}) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[240px] place-items-center rounded-lg border border-white/[0.07] bg-white/[0.035] p-6 text-sm font-semibold text-zinc-400">
          Загружаем раздел...
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export default function AppRoutes({activePage, ...props}) {
  switch (activePage) {
    case "today":
      return (
        <TodayPage
          alertSummary={props.alertSummary}
          alerts={props.alerts}
          appSettings={props.appSettings}
          calendarEntries={props.calendarEntries}
          certificates={props.certificates}
          clientPackages={props.clientPackages}
          clientProfiles={props.clientProfiles}
          employees={props.activeEmployees}
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
      );

    case "calendar":
      return (
        <PageSuspense>
          <CalendarPage
            alertFocus={props.alertFocus}
            entries={props.calendarEntriesWithServiceColors}
            visits={props.visits}
            clients={props.clientProfiles}
            clientPackages={props.clientPackages}
            employees={props.activeEmployees}
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
            closeDay={props.closeDay}
            dayCloseRecords={props.dayCloseRecords}
            filters={props.paymentFilters}
            getDayCloseJournal={props.getDayCloseJournal}
            masters={props.masters}
            openActionMenuId={props.openPaymentActionMenuId}
            reopenDayClose={props.reopenDayClose}
            removeDayClose={props.removeDayClose}
            visits={props.filteredPaymentRows}
            onAddPayment={props.openCreatePayment}
            onDeleteVisit={props.deletePaymentRow}
            onEditVisit={props.editPaymentRow}
            onFilterChange={props.onPaymentFilterChange}
            onResetFilters={props.onPaymentFiltersReset}
            onToggleActionMenu={props.setOpenPaymentActionMenuId}
          />
        </PageSuspense>
      );

    case "clients":
      return (
        <PageSuspense>
          <ClientsPage
            alertFocus={props.alertFocus}
            visits={props.visits}
            calendarEntries={props.calendarEntries}
            clients={props.clientProfiles}
            clientPackages={props.clientPackages}
            certificates={props.certificates}
            communicationLog={props.communicationLog}
            employees={props.employees}
            inactiveClientDays={props.inactiveClientDays}
            onAddClient={props.openCreateClient}
            onAddVisit={props.openCreateCalendarEntry}
            onAlertFocusHandled={props.clearAlertFocus}
            onMessageClient={props.openClientMessageTemplates}
            onEditClient={props.openEditClient}
            onUpdateClientNote={props.updateClientNote}
            onDeleteClient={props.requestDeleteClient}
          />
        </PageSuspense>
      );

    case "services":
      return (
        <ServicesPage
          services={props.serviceCatalog}
          onAdd={props.openCreateService}
          onEdit={props.openEditService}
          onDelete={props.requestDeleteService}
        />
      );

    case "packages":
      return (
        <PackagesPage
          packages={props.packagesCatalog}
          clientPackages={props.clientPackages}
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
      );

    case "masters":
      return (
        <EmployeesPage
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
          onAdd={props.openCreateEmployee}
          onEdit={props.openEditEmployee}
          onDelete={props.requestDeleteEmployee}
        />
      );

    case "templates":
      return (
        <MessageTemplatesPage
          bulkSms={props.bulkSms}
          templates={props.messageTemplates}
          clients={props.clientProfiles}
          preferredClientId={props.preferredMessageClientId}
          onClearPreferredClient={props.clearPreferredMessageClientId}
          onAdd={props.openCreateMessageTemplate}
          onEdit={props.openEditMessageTemplate}
          onDelete={props.requestDeleteMessageTemplate}
          onNotify={props.pushNotification}
          onMessageSent={props.logClientMessage}
        />
      );

    case "operations":
      return (
        <PageSuspense>
          <OperationsPage
            alertFocus={props.alertFocus}
            tasks={props.tasks}
            supplies={props.supplies}
            waitlistEntries={props.waitlistEntries}
            onAddTask={props.openCreateTask}
            onAddNote={props.addQuickNote}
            onAddWaitlistEntry={props.openCreateWaitlistEntry}
            onAlertFocusHandled={props.clearAlertFocus}
            onBookWaitlistEntry={props.bookWaitlistEntryFromPanel}
            onCompleteTask={props.completeTask}
            onDeleteTask={props.requestDeleteTask}
            onEditTask={props.openEditTask}
            onEditWaitlistEntry={props.openEditWaitlistEntry}
            onMessageWaitlistEntry={props.messageWaitlistEntryFromPanel}
            onRemoveWaitlistEntry={props.removeWaitlistEntry}
            onReorderTasks={props.reorderTasks}
            onAddSupply={props.openCreateSupply}
            onEditSupply={props.openEditSupply}
            onDeleteSupply={props.requestDeleteSupply}
            onChangeSupplyStock={props.changeSupplyStock}
          />
        </PageSuspense>
      );

    case "import":
      return (
        <ImportPage
          booksyGmailSync={props.booksyGmailSync}
          calendarEntries={props.calendarEntries}
          documents={props.importDocuments}
          onDeleteDocuments={props.deleteImportDocuments}
        />
      );

    case "statistics":
      return (
        <PageSuspense>
          <StatisticsPage
            visits={props.paymentRows}
            calendarEntries={props.calendarEntries}
            certificates={props.certificates}
            clientPackages={props.clientPackages}
            clients={props.clientProfiles}
            employees={props.employees}
          />
        </PageSuspense>
      );

    case "site":
      return (
        <SitePage
          settings={props.appSettings}
          siteBooking={props.siteBooking}
          pushNotification={props.pushNotification}
          onSubmit={props.handleSiteSettingsSubmit}
        />
      );

    case "settings":
      return (
        <PageSuspense>
          <SettingsPage
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
}
