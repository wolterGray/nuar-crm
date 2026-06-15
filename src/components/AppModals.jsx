import ConfirmDialog from "./ConfirmDialog.jsx";
import FormModalShell from "./FormModalShell.jsx";
import {getEntityDeleteDialogContent} from "../utils/entityDeleteDialog.js";
import EmployeeForm from "./EmployeeForm.jsx";
import NewClientForm from "./NewClientForm.jsx";
import ServiceForm from "./ServiceForm.jsx";
import PackageForm from "./PackageForm.jsx";
import ClientPackageForm from "./ClientPackageForm.jsx";
import CertificateForm from "./CertificateForm.jsx";
import MessageTemplateForm from "./MessageTemplateForm.jsx";
import CalendarEntryForm from "./CalendarEntryForm.jsx";
import WaitlistForm from "./WaitlistForm.jsx";
import TaskForm from "./TaskForm.jsx";
import SupplyForm from "./SupplyForm.jsx";
import FinancialOperationForm from "./FinancialOperationForm.jsx";
import {
  formatBackupExportedAt,
  getBackupPreview,
} from "../utils/backupFormat.js";

function BackupImportPreview({backup}) {
  if (!backup) {
    return null;
  }

  const preview = getBackupPreview(backup);

  return (
    <dl className="backup-import-preview">
      <div>
        <dt>Версия схемы</dt>
        <dd>{preview.version}</dd>
      </div>
      <div>
        <dt>Экспорт</dt>
        <dd>{formatBackupExportedAt(preview.exportedAt)}</dd>
      </div>
      <div>
        <dt>Визиты</dt>
        <dd>{preview.counts.visits}</dd>
      </div>
      <div>
        <dt>Клиенты</dt>
        <dd>{preview.counts.clients}</dd>
      </div>
      <div>
        <dt>Календарь</dt>
        <dd>{preview.counts.calendarEntries}</dd>
      </div>
      <div>
        <dt>Сотрудники</dt>
        <dd>{preview.counts.employees}</dd>
      </div>
      <div>
        <dt>Услуги</dt>
        <dd>{preview.counts.services}</dd>
      </div>
      <div>
        <dt>Пакеты клиентов</dt>
        <dd>{preview.counts.clientPackages}</dd>
      </div>
    </dl>
  );
}

export default function AppModals({
  employeeModalOpen,
  clientModalOpen,
  serviceModalOpen,
  packageModalOpen,
  clientPackageModalOpen,
  certificateModalOpen,
  messageTemplateModalOpen,
  calendarEntryModalOpen,
  taskModalOpen,
  supplyModalOpen,
  financialOperationModalOpen,
  waitlistModalOpen,
  editingEmployee,
  editingClient,
  editingService,
  editingPackage,
  editingClientPackage,
  editingCertificate,
  editingMessageTemplate,
  editingCalendarEntry,
  editingTask,
  editingSupply,
  editingFinancialOperation,
  editingWaitlistEntry,
  waitlistDefaults,
  editingJournalVisit,
  serviceNames,
  clientNames,
  employees,
  packagesCatalog,
  calendarEntries,
  clientProfiles,
  clientPackages,
  certificates,
  paymentRows,
  calendarEntryDefaults,
  defaultStatsDate,
  masters,
  serviceCatalog,
  pendingCalendarAction,
  pendingCalendarConflict,
  pendingPaymentDelete,
  pendingDataBackup,
  pendingEntityDelete,
  onCancelEntityDelete,
  onConfirmEntityDelete,
  onCloseEmployeeModal,
  onCloseClientModal,
  onCloseServiceModal,
  onClosePackageModal,
  onCloseClientPackageModal,
  onCloseCertificateModal,
  onCloseMessageTemplateModal,
  onCloseCalendarEntryModal,
  onCloseTaskModal,
  onCloseSupplyModal,
  onCloseFinancialOperationModal,
  onCloseWaitlistModal,
  onEmployeeSubmit,
  onClientSubmit,
  onServiceSubmit,
  onPackageSubmit,
  onClientPackageSubmit,
  onCertificateSubmit,
  onMessageTemplateSubmit,
  onCalendarEntrySubmit,
  onTaskSubmit,
  onSupplySubmit,
  onFinancialOperationSubmit,
  onWaitlistSubmit,
  onCreateCalendarClient,
  onCancelCalendarAction,
  onConfirmCalendarAction,
  onCancelCalendarConflict,
  onConfirmCalendarConflict,
  onCancelPaymentDelete,
  onConfirmPaymentDelete,
  onCancelDataBackup,
  onConfirmDataBackup,
}) {
  const activeEmployees = employees.filter(
    (employee) => employee.status !== "Архив",
  );
  const entityDeleteDialog = getEntityDeleteDialogContent(pendingEntityDelete);

  return (
    <>
      <FormModalShell
        className="employee-modal employee-form-modal"
        isOpen={employeeModalOpen}
        labelledBy="employee-modal-title"
        title={
          editingEmployee ? "Редактировать сотрудника" : "Добавить сотрудника"
        }
        onClose={onCloseEmployeeModal}>
        <EmployeeForm employee={editingEmployee} onSubmit={onEmployeeSubmit} />
      </FormModalShell>

      <FormModalShell
        className="employee-modal client-form-modal"
        isOpen={clientModalOpen}
        labelledBy="client-modal-title"
        title={editingClient ? "Редактировать клиента" : "Добавить клиента"}
        onClose={onCloseClientModal}>
        <NewClientForm client={editingClient} onSubmit={onClientSubmit} />
      </FormModalShell>

      <FormModalShell
        className="employee-modal catalog-modal service-form-modal"
        isOpen={serviceModalOpen}
        labelledBy="service-modal-title"
        title={editingService ? "Редактировать услугу" : "Добавить услугу"}
        onClose={onCloseServiceModal}>
        <ServiceForm service={editingService} onSubmit={onServiceSubmit} />
      </FormModalShell>

      <FormModalShell
        className="employee-modal catalog-modal package-form-modal"
        isOpen={packageModalOpen}
        labelledBy="package-modal-title"
        title={editingPackage ? "Редактировать пакет" : "Добавить пакет"}
        onClose={onClosePackageModal}>
        <PackageForm
          packageItem={editingPackage}
          services={serviceNames}
          onSubmit={onPackageSubmit}
        />
      </FormModalShell>

      <FormModalShell
        className="employee-modal catalog-modal package-form-modal"
        isOpen={clientPackageModalOpen}
        labelledBy="client-package-modal-title"
        title={
          editingClientPackage
            ? "Редактировать остаток"
            : "Продать пакет клиенту"
        }
        onClose={onCloseClientPackageModal}>
        <ClientPackageForm
          clientPackage={editingClientPackage}
          clients={clientNames}
          employees={activeEmployees}
          packages={packagesCatalog}
          onSubmit={onClientPackageSubmit}
        />
      </FormModalShell>

      <FormModalShell
        className="employee-modal catalog-modal package-form-modal"
        isOpen={certificateModalOpen}
        labelledBy="certificate-modal-title"
        title={
          editingCertificate ? "Редактировать сертификат" : "Продать сертификат"
        }
        onClose={onCloseCertificateModal}>
        <CertificateForm
          certificate={editingCertificate}
          certificates={certificates}
          clients={clientNames}
          employees={activeEmployees}
          onSubmit={onCertificateSubmit}
        />
      </FormModalShell>

      <FormModalShell
        className="employee-modal catalog-modal message-template-modal message-template-form-modal"
        isOpen={messageTemplateModalOpen}
        labelledBy="message-template-modal-title"
        title={
          editingMessageTemplate ? "Редактировать шаблон" : "Добавить шаблон"
        }
        onClose={onCloseMessageTemplateModal}>
        <MessageTemplateForm
          template={editingMessageTemplate}
          onSubmit={onMessageTemplateSubmit}
        />
      </FormModalShell>

      <FormModalShell
        backdropClassName="calendar-entry-backdrop"
        className="employee-modal calendar-entry-modal"
        fullscreen
        isOpen={calendarEntryModalOpen}
        labelledBy="calendar-entry-modal-title"
        title={
          editingJournalVisit
            ? "Редактировать визит"
            : editingCalendarEntry
              ? "Редактировать запись"
              : "Добавить в календарь"
        }
        onClose={onCloseCalendarEntryModal}>
        <CalendarEntryForm
          calendarEntries={calendarEntries}
          certificates={certificates}
          clientPackages={clientPackages}
          clients={clientProfiles}
          employees={activeEmployees}
          initialEntry={editingCalendarEntry}
          selectedAmount={calendarEntryDefaults.amount ?? ""}
          selectedClient={calendarEntryDefaults.client ?? ""}
          selectedDate={calendarEntryDefaults.date ?? defaultStatsDate}
          selectedDuration={calendarEntryDefaults.duration ?? 60}
          selectedKind={calendarEntryDefaults.kind ?? "visit"}
          selectedMaster={calendarEntryDefaults.master ?? masters[0] ?? ""}
          selectedPayment={calendarEntryDefaults.payment ?? "Наличные"}
          selectedServiceId={calendarEntryDefaults.serviceId ?? ""}
          selectedTime={calendarEntryDefaults.time ?? "10:00"}
          services={serviceCatalog}
          visits={paymentRows}
          onCreateClient={onCreateCalendarClient}
          onSubmit={onCalendarEntrySubmit}
        />
      </FormModalShell>

      <FormModalShell
        className="employee-modal catalog-modal"
        isOpen={taskModalOpen}
        labelledBy="task-modal-title"
        title={
          editingTask?.type === "note"
            ? "Редактировать заметку"
            : editingTask
              ? "Редактировать задачу"
              : "Новая задача"
        }
        onClose={onCloseTaskModal}>
        <TaskForm task={editingTask} onSubmit={onTaskSubmit} />
      </FormModalShell>

      <FormModalShell
        className="employee-modal catalog-modal"
        isOpen={supplyModalOpen}
        labelledBy="supply-modal-title"
        title={editingSupply ? "Редактировать расходник" : "Новый расходник"}
        onClose={onCloseSupplyModal}>
        <SupplyForm supply={editingSupply} onSubmit={onSupplySubmit} />
      </FormModalShell>

      <FormModalShell
        className="employee-modal"
        isOpen={financialOperationModalOpen}
        labelledBy="financial-operation-modal-title"
        title={
          editingFinancialOperation
            ? "Редактировать поступление"
            : "Добавить поступление"
        }
        onClose={onCloseFinancialOperationModal}>
        <FinancialOperationForm
          clients={clientProfiles}
          operation={editingFinancialOperation}
          onSubmit={onFinancialOperationSubmit}
        />
      </FormModalShell>

      <ConfirmDialog
        confirmLabel={
          pendingCalendarAction?.type === "delete" ? "Удалить" : "Редактировать"
        }
        message={
          pendingCalendarAction?.type === "delete"
            ? "Запись исчезнет из календаря."
            : "Открыть форму и изменить данные записи?"
        }
        open={Boolean(pendingCalendarAction)}
        title={
          pendingCalendarAction?.type === "delete"
            ? "Удалить запись?"
            : "Редактировать запись?"
        }
        onCancel={onCancelCalendarAction}
        onConfirm={onConfirmCalendarAction}
      />
      <ConfirmDialog
        confirmLabel="Сохранить"
        message={[
          pendingCalendarConflict?.shiftWarning,
          (pendingCalendarConflict?.conflicts.length ?? 0) > 0
            ? `У этого мастера уже есть ${pendingCalendarConflict.conflicts.length} пересекающихся записей.`
            : "",
          "Всё равно сохранить запись?",
        ]
          .filter(Boolean)
          .join(" ")}
        open={Boolean(pendingCalendarConflict)}
        title={
          pendingCalendarConflict?.shiftWarning
            ? "Проверьте время записи"
            : "Конфликт в календаре"
        }
        onCancel={onCancelCalendarConflict}
        onConfirm={onConfirmCalendarConflict}
      />
      <ConfirmDialog
        confirmLabel="Удалить"
        message={
          pendingPaymentDelete?.calendarEntryId
            ? "Запись будет удалена из календаря и финансового отчета полностью."
            : "Запись будет удалена из финансового отчета."
        }
        open={Boolean(pendingPaymentDelete)}
        title={
          pendingPaymentDelete?.recordType === "operation"
            ? "Удалить поступление?"
            : "Удалить визит из финжурнала?"
        }
        onCancel={onCancelPaymentDelete}
        onConfirm={onConfirmPaymentDelete}
      />
      <ConfirmDialog
        confirmLabel="Восстановить"
        message={
          pendingDataBackup ? (
            <>
              <p>
                Текущие локальные данные будут заменены содержимым резервной
                копии.
              </p>
              <BackupImportPreview backup={pendingDataBackup} />
            </>
          ) : (
            ""
          )
        }
        open={Boolean(pendingDataBackup)}
        title="Восстановить базу?"
        onCancel={onCancelDataBackup}
        onConfirm={onConfirmDataBackup}
      />

      <FormModalShell
        className="employee-modal client-form-modal"
        isOpen={waitlistModalOpen}
        labelledBy="waitlist-modal-title"
        title={
          editingWaitlistEntry
            ? "Редактировать лист ожидания"
            : "Добавить в лист ожидания"
        }
        onClose={onCloseWaitlistModal}>
        <WaitlistForm
          key={
            editingWaitlistEntry?.id ??
            `create-${waitlistDefaults?.clientId ?? "none"}`
          }
          clientProfiles={clientProfiles}
          defaults={waitlistDefaults}
          editingEntry={editingWaitlistEntry}
          employees={activeEmployees}
          serviceCatalog={serviceCatalog}
          onClose={onCloseWaitlistModal}
          onSubmit={onWaitlistSubmit}
        />
      </FormModalShell>

      {entityDeleteDialog && (
        <ConfirmDialog
          confirmLabel={entityDeleteDialog.confirmLabel}
          message={entityDeleteDialog.message}
          open={Boolean(pendingEntityDelete)}
          title={entityDeleteDialog.title}
          onCancel={onCancelEntityDelete}
          onConfirm={onConfirmEntityDelete}
        />
      )}
    </>
  );
}
