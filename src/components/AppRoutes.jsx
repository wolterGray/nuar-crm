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
import SitePage from "./pages/SitePage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

export default function AppRoutes({activePage, ...props}) {
  switch (activePage) {
    case "calendar":
      return (
        <CalendarPage
          entries={props.calendarEntriesWithServiceColors}
          visits={props.visits}
          clients={props.clientProfiles}
          clientPackages={props.clientPackages}
          employees={props.activeEmployees}
          settings={props.appSettings}
          onAdd={props.openCreateCalendarEntry}
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
          filters={props.paymentFilters}
          masters={props.masters}
          openActionMenuId={props.openPaymentActionMenuId}
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
          visits={props.visits}
          calendarEntries={props.calendarEntries}
          clients={props.clientProfiles}
          clientPackages={props.clientPackages}
          communicationLog={props.communicationLog}
          employees={props.employees}
          inactiveClientDays={props.inactiveClientDays}
          onAddClient={props.openCreateClient}
          onEditClient={props.openEditClient}
          onUpdateClientNote={props.updateClientNote}
          onDeleteClient={props.requestDeleteClient}
          onMessageClient={props.openClientMessageTemplates}
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
          certificates={props.certificateVisits}
          packageSalesIncome={props.packageSalesIncome}
          onAdd={props.openCreatePackage}
          onEdit={props.openEditPackage}
          onDelete={props.requestDeletePackage}
          onSellPackage={props.openCreateClientPackage}
          onEditClientPackage={props.openEditClientPackage}
          onDeleteClientPackage={props.requestDeleteClientPackage}
        />
      );

    case "masters":
      return (
        <EmployeesPage
          employees={props.employeeStats}
          onAdd={props.openCreateEmployee}
          onEdit={props.openEditEmployee}
          onDelete={props.requestDeleteEmployee}
        />
      );

    case "templates":
      return (
        <MessageTemplatesPage
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
          tasks={props.tasks}
          supplies={props.supplies}
          onAddTask={props.openCreateTask}
          onAddNote={props.addQuickNote}
          onEditTask={props.openEditTask}
          onDeleteTask={props.requestDeleteTask}
          onCompleteTask={props.completeTask}
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
          documents={props.importDocuments}
          employees={props.employees}
          gmailAccessToken={props.gmailAccessToken}
          gmailClientId={props.appSettings.gmailClientId}
          importedMailIds={props.importedMailIds}
          services={props.serviceCatalog}
          onApply={props.applyMailImports}
          onGoogleLogin={props.handleGoogleLogin}
          onNotify={props.pushNotification}
          onOpenSettings={props.openSettingsPage}
        />
      );

    case "statistics":
      return (
        <StatisticsPage
          visits={props.paymentRows}
          calendarEntries={props.calendarEntries}
          clientPackages={props.clientPackages}
          clients={props.clientProfiles}
          employees={props.employees}
        />
      );

    case "site":
      return <SitePage />;

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
