import {X} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog.jsx";
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
      {employeeModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal"
            role="dialog"
            aria-labelledby="employee-modal-title">
            <div className="modal-header">
              <h2 id="employee-modal-title">
                {editingEmployee
                  ? "Редактировать сотрудника"
                  : "Добавить сотрудника"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={onCloseEmployeeModal}>
                <X size={18} />
              </button>
            </div>
            <EmployeeForm employee={editingEmployee} onSubmit={onEmployeeSubmit} />
          </section>
        </div>
      )}

      {clientModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal client-form-modal"
            role="dialog"
            aria-labelledby="client-modal-title">
            <div className="modal-header">
              <h2 id="client-modal-title">
                {editingClient ? "Редактировать клиента" : "Добавить клиента"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={onCloseClientModal}>
                <X size={18} />
              </button>
            </div>
            <NewClientForm client={editingClient} onSubmit={onClientSubmit} />
          </section>
        </div>
      )}

      {serviceModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal catalog-modal"
            role="dialog"
            aria-labelledby="service-modal-title">
            <div className="modal-header">
              <h2 id="service-modal-title">
                {editingService ? "Редактировать услугу" : "Добавить услугу"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={onCloseServiceModal}>
                <X size={18} />
              </button>
            </div>
            <ServiceForm service={editingService} onSubmit={onServiceSubmit} />
          </section>
        </div>
      )}

      {packageModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal catalog-modal"
            role="dialog"
            aria-labelledby="package-modal-title">
            <div className="modal-header">
              <h2 id="package-modal-title">
                {editingPackage ? "Редактировать пакет" : "Добавить пакет"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={onClosePackageModal}>
                <X size={18} />
              </button>
            </div>
            <PackageForm
              packageItem={editingPackage}
              services={serviceNames}
              onSubmit={onPackageSubmit}
            />
          </section>
        </div>
      )}

      {clientPackageModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal catalog-modal"
            role="dialog"
            aria-labelledby="client-package-modal-title">
            <div className="modal-header">
              <h2 id="client-package-modal-title">
                {editingClientPackage
                  ? "Редактировать остаток"
                  : "Продать пакет клиенту"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={onCloseClientPackageModal}>
                <X size={18} />
              </button>
            </div>
            <ClientPackageForm
              clientPackage={editingClientPackage}
              clients={clientNames}
              employees={activeEmployees}
              packages={packagesCatalog}
              onSubmit={onClientPackageSubmit}
            />
          </section>
        </div>
      )}

      {certificateModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal catalog-modal"
            role="dialog"
            aria-labelledby="certificate-modal-title">
            <div className="modal-header">
              <h2 id="certificate-modal-title">
                {editingCertificate
                  ? "Редактировать сертификат"
                  : "Продать сертификат"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={onCloseCertificateModal}>
                <X size={18} />
              </button>
            </div>
            <CertificateForm
              certificate={editingCertificate}
              certificates={certificates}
              clients={clientNames}
              employees={activeEmployees}
              onSubmit={onCertificateSubmit}
            />
          </section>
        </div>
      )}

      {messageTemplateModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal message-template-modal"
            role="dialog"
            aria-labelledby="message-template-modal-title">
            <div className="modal-header">
              <h2 id="message-template-modal-title">
                {editingMessageTemplate
                  ? "Редактировать шаблон"
                  : "Добавить шаблон"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={onCloseMessageTemplateModal}>
                <X size={18} />
              </button>
            </div>
            <MessageTemplateForm
              template={editingMessageTemplate}
              onSubmit={onMessageTemplateSubmit}
            />
          </section>
        </div>
      )}

      {calendarEntryModalOpen && (
        <div className="modal-backdrop calendar-entry-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal calendar-entry-modal"
            role="dialog"
            aria-labelledby="calendar-entry-modal-title">
            <div className="modal-header">
              <h2 id="calendar-entry-modal-title">
                {editingJournalVisit
                  ? "Редактировать визит"
                  : editingCalendarEntry
                    ? "Редактировать запись"
                    : "Добавить в календарь"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={onCloseCalendarEntryModal}>
                <X size={18} />
              </button>
            </div>
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
          </section>
        </div>
      )}

      {taskModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal catalog-modal"
            role="dialog"
            aria-labelledby="task-modal-title">
            <div className="modal-header">
              <h2 id="task-modal-title">
                {editingTask?.type === "note"
                  ? "Редактировать заметку"
                  : editingTask
                    ? "Редактировать задачу"
                    : "Новая задача"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={onCloseTaskModal}>
                <X size={18} />
              </button>
            </div>
            <TaskForm task={editingTask} onSubmit={onTaskSubmit} />
          </section>
        </div>
      )}

      {supplyModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal catalog-modal"
            role="dialog"
            aria-labelledby="supply-modal-title">
            <div className="modal-header">
              <h2 id="supply-modal-title">
                {editingSupply ? "Редактировать расходник" : "Новый расходник"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={onCloseSupplyModal}>
                <X size={18} />
              </button>
            </div>
            <SupplyForm supply={editingSupply} onSubmit={onSupplySubmit} />
          </section>
        </div>
      )}

      {financialOperationModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="financial-operation-modal-title"
            aria-modal="true"
            className="employee-modal"
            role="dialog">
            <div className="modal-header">
              <h2 id="financial-operation-modal-title">
                {editingFinancialOperation
                  ? "Редактировать поступление"
                  : "Добавить поступление"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={onCloseFinancialOperationModal}>
                <X size={18} />
              </button>
            </div>
            <FinancialOperationForm
              clients={clientProfiles}
              operation={editingFinancialOperation}
              onSubmit={onFinancialOperationSubmit}
            />
          </section>
        </div>
      )}

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

      {waitlistModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="employee-modal client-form-modal"
            role="dialog"
            aria-labelledby="waitlist-modal-title">
            <div className="modal-header">
              <h2 id="waitlist-modal-title">
                {editingWaitlistEntry
                  ? "Редактировать лист ожидания"
                  : "Добавить в лист ожидания"}
              </h2>
              <button
                aria-label="Закрыть форму"
                className="modal-close"
                type="button"
                onClick={onCloseWaitlistModal}>
                <X size={18} />
              </button>
            </div>
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
          </section>
        </div>
      )}

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
