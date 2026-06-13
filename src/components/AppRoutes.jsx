import CalendarPage from "./pages/CalendarPage.jsx";
import PaymentsPage from "./pages/PaymentsPage.jsx";
import ClientsPage from "./pages/ClientsPage.jsx";
import ServicesPage from "./pages/ServicesPage.jsx";
import PackagesPage from "./pages/PackagesPage.jsx";
import EmployeesPage from "./EmployeesPage.jsx";
import MessageTemplatesPage from "./pages/MessageTemplatesPage.jsx";
import OperationsPage from "./pages/OperationsPage.jsx";
import ImportPage from "./pages/ImportPage.jsx";
import StatisticsPage from "./pages/StatisticsPage.jsx";
import TodayPage from "./pages/TodayPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

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
          onOpenOperations={() => props.setActivePage("operations")}
          onOpenPayments={() => props.setActivePage("payments")}
          onRemindVisit={props.remindCalendarClient}
        />
      );

    case "calendar":
      return (
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
      );

    case "payments":
      return (
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
      );

    case "clients":
      return (
        <ClientsPage
          alertFocus={props.alertFocus}
          visits={props.visits}
          calendarEntries={props.calendarEntries}
          clients={props.clientProfiles}
          clientPackages={props.clientPackages}
          communicationLog={props.communicationLog}
          employees={props.employees}
          inactiveClientDays={props.inactiveClientDays}
          onAddClient={props.openCreateClient}
          onAlertFocusHandled={props.clearAlertFocus}
          onEditClient={props.openEditClient}
          onUpdateClientNote={props.updateClientNote}
          onDeleteClient={props.requestDeleteClient}
          onMessageClient={props.openClientMessageTemplates}
          onAddToWaitlist={(client) =>
            props.openCreateWaitlistEntry({clientId: client.id})
          }
          onAddVisit={props.addClientCalendarVisit}
          onRepeatVisit={props.repeatClientVisit}
        />
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
          getPayrollReport={props.getPayrollReport}
          markPayrollPaid={props.markPayrollPaid}
          payrollRecords={props.payrollRecords}
          removePayrollRecord={props.removePayrollRecord}
          reopenPayrollRecord={props.reopenPayrollRecord}
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
        <StatisticsPage
          visits={props.paymentRows}
          calendarEntries={props.calendarEntries}
          certificates={props.certificates}
          clientPackages={props.clientPackages}
          clients={props.clientProfiles}
          employees={props.employees}
        />
      );

    case "site":
      return (
        <SettingsPage
          initialTab="integrations"
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
          siteBooking={props.siteBooking}
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
      );

    case "settings":
      return (
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
      );

    default:
      return (
        <StatisticsPage
          visits={props.paymentRows}
          calendarEntries={props.calendarEntries}
          clientPackages={props.clientPackages}
          clients={props.clientProfiles}
          employees={props.employees}
        />
      );
  }
}
