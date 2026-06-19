import {
  CakeSlice,
  CalendarPlus,
  Clock3,
  Eye,
  MessageSquareText,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import {
  formatMoney,
  getDaysSinceDisplayDate,
  getLatestDisplayDate,
  toDisplayDate,
  toInputDate,
} from "../../utils/formatters.jsx";
import {getVisitTotal} from "../../utils/visits.jsx";
import {matchesClientRecord} from "../../utils/clientLinks.js";
import {
  isActiveClientPackage,
  isArchivedClientPackage,
} from "../../utils/clientPackages.js";
import PageHeader from "../PageHeader.jsx";
import MobileSheet from "../MobileSheet.jsx";
import SearchControl from "../ui/SearchControl.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";

function ClientsPage({
  alertFocus,
  visits,
  calendarEntries,
  clients,
  clientPackages,
  communicationLog,
  employees,
  inactiveClientDays,
  onAddClient,
  onAlertFocusHandled,
  onEditClient,
  onUpdateClientNote,
  onDeleteClient,
  onMessageClient,
  onAddToWaitlist,
  onAddVisit,
  onRepeatVisit,
  onViewedClientChange,
}) {
  const [openClientMenuId, setOpenClientMenuId] = useState(null);
  const [viewedClient, setViewedClient] = useState(null);
  const [visitHistoryTab, setVisitHistoryTab] = useState("future");
  const [search, setSearch] = useState("");
  const {isMobile} = useBreakpoint();

  useEffect(() => {
    onViewedClientChange?.(Boolean(viewedClient));
  }, [onViewedClientChange, viewedClient]);

  const viewedClientCommunications = communicationLog
    .filter(
      (entry) =>
        entry.clientId === viewedClient?.id ||
        entry.clientName === viewedClient?.name,
    )
    .slice(0, 5);

  const clientsData = useMemo(
    () =>
      clients.map((client) => {
        const clientVisits = visits.filter(
          (visit) =>
            matchesClientRecord(visit, clients, client) &&
            visit.recordType !== "operation",
        );
        const clientOperations = visits.filter(
          (visit) =>
            matchesClientRecord(visit, clients, client) &&
            visit.recordType === "operation",
        );
        const scheduledEntries = calendarEntries.filter(
          (entry) =>
            entry.kind === "visit" && matchesClientRecord(entry, clients, client),
        );
        const completedCalendarDates = scheduledEntries
          .filter((entry) => getAppointmentStatus(entry) === "Окончен")
          .map((entry) => toDisplayDate(entry.date));
        const linkedVisitIds = new Set(
          scheduledEntries.map((entry) => entry.visitId).filter(Boolean),
        );
        const appointments = [
          ...scheduledEntries.map((entry) => {
            const journalVisit = clientVisits.find(
              (visit) => visit.id === entry.visitId,
            );

            return {
              id: `calendar-${entry.id}`,
              date: toDisplayDate(entry.date),
              inputDate: entry.date,
              time: entry.time || "—",
              service: entry.service || "Услуга не указана",
              master: entry.master || "—",
              payment: journalVisit?.payment || entry.payment || "—",
              total: journalVisit
                ? getVisitTotal(journalVisit, employees)
                : null,
              status: getAppointmentStatus(entry),
              repeatDefaults: {
                amount: entry.amount || journalVisit?.amount || "",
                duration: entry.duration || journalVisit?.duration || 60,
                master: entry.master || journalVisit?.master || "",
                payment: entry.payment || journalVisit?.payment || "Наличные",
                service: entry.service || journalVisit?.service || "",
                serviceId: entry.serviceId || "",
              },
            };
          }),
          ...clientVisits
            .filter((visit) => !linkedVisitIds.has(visit.id))
            .map((visit) => ({
              id: `journal-${visit.id}`,
              date: visit.date,
              inputDate: toInputDate(visit.date),
              time: visit.time || "—",
              service: visit.service || "Услуга не указана",
              master: visit.master || "—",
              payment: visit.payment || "—",
              total: getVisitTotal(visit, employees),
              status: "Окончен",
              repeatDefaults: {
                amount: visit.amount || "",
                duration: visit.duration || 60,
                master: visit.master || "",
                payment: visit.payment || "Наличные",
                service: visit.service || "",
                serviceId: "",
              },
            })),
        ].sort((first, second) =>
          `${second.inputDate}T${second.time}`.localeCompare(
            `${first.inputDate}T${first.time}`,
          ),
        );
        const packages = clientPackages.filter((packageItem) =>
          matchesClientRecord(packageItem, clients, client),
        );
        const activePackages = packages.filter(isActiveClientPackage);
        const totalIncome =
          clientVisits.reduce(
            (sum, visit) => sum + getVisitTotal(visit, employees),
            0,
          ) +
          clientOperations.reduce(
            (sum, visit) => sum + getVisitTotal(visit, employees),
            0,
          ) +
          packages.reduce(
            (sum, packageItem) => sum + (Number(packageItem.price) || 0),
            0,
          );
        const packagesLeft = activePackages.reduce(
          (sum, packageItem) =>
            sum + (Number(packageItem.remainingVisits) || 0),
          0,
        );
        const lastVisit =
          getLatestDisplayDate([
            ...clientVisits.map((visit) => visit.date),
            ...completedCalendarDates,
          ]) || "—";
        const daysAbsent = getDaysSinceDisplayDate(lastVisit);

        return {
          ...client,
          visitsCount: appointments.length,
          completedVisitsCount: clientVisits.length,
          upcomingVisitsCount: appointments.filter(
            (appointment) => appointment.status === "Запланирован",
          ).length,
          appointments,
          totalIncome,
          packagesCount: activePackages.length,
          packagesLeft,
          archivedPackagesCount: packages.filter(isArchivedClientPackage).length,
          lastVisit,
          daysAbsent,
        };
      }),
    [calendarEntries, clientPackages, clients, employees, visits],
  );
  const activeViewedClient = useMemo(() => {
    if (!viewedClient) {
      return null;
    }

    return clientsData.find((client) => client.id === viewedClient.id) ?? viewedClient;
  }, [clientsData, viewedClient]);

  useEffect(() => {
    if (!alertFocus?.entityId || alertFocus.type !== "client") {
      return undefined;
    }

    const client =
      clients.find(
        (item) =>
          String(item.id) === String(alertFocus.entityId) ||
          item.name === alertFocus.entityId,
      ) ?? null;

    const setupTimer = window.setTimeout(() => {
      if (client) {
        setViewedClient(client);
      }

      document
        .getElementById(`alert-focus-client-${alertFocus.entityId}`)
        ?.scrollIntoView({behavior: "smooth", block: "center"});
    }, 0);
    const clearTimer = window.setTimeout(() => {
      onAlertFocusHandled?.();
    }, 4500);

    return () => {
      window.clearTimeout(setupTimer);
      window.clearTimeout(clearTimer);
    };
  }, [alertFocus, clients, onAlertFocusHandled]);

  const isFocusedClient = (client) =>
    alertFocus?.type === "client" &&
    (String(alertFocus.entityId) === String(client.id) ||
      alertFocus.entityId === client.name);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredClients = clientsData.filter((client) =>
    [
      client.name,
      client.phone,
      client.email,
      client.birthday,
      client.instagram,
      client.telegram,
      client.note,
      client.source,
      client.preference,
      client.status,
      client.tags,
      client.lastVisit,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch),
  );

  return (
    <section
      className={`panel clients-page ${isMobile ? "clients-page-mobile" : ""}`}
      onClick={() => setOpenClientMenuId(null)}>
      <PageHeader
        actions={
          <>
            <SearchControl
              className="clients-search-control"
              placeholder="Поиск клиента"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOpenClientMenuId(null);
              }}
              onClear={() => setSearch("")}
            />
            <button className="add-visit-button" type="button" onClick={onAddClient}>
              <Plus size={18} />
              {isMobile ? "Добавить" : "Добавить клиента"}
            </button>
          </>
        }
        description={isMobile ? undefined : `${filteredClients.length} из ${clients.length} в базе`}
        title="Клиенты"
      />

      <div className="clients-table">
        <div className="clients-table-row clients-table-head">
          <span>Клиент</span>
          <span>Статус</span>
          <span>Визитов</span>
          <span>Пакеты</span>
          <span>Сумма</span>
          <span>Последний визит</span>
          <span>Не был</span>
          <span>Заметка</span>
          <span></span>
        </div>

        {filteredClients.map((client) => (
          <div
            className={`clients-table-row ${
              client.daysAbsent === null ||
              client.daysAbsent >= inactiveClientDays
                ? "client-needs-contact"
                : ""
            } ${isFocusedClient(client) ? "alert-focus-pulse" : ""}`}
            id={`alert-focus-client-${client.id}`}
            role="button"
            tabIndex="0"
            key={client.id}
            onClick={() => {
              setViewedClient(client);
              setVisitHistoryTab("future");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setViewedClient(client);
                setVisitHistoryTab("future");
              }
            }}>
            <span className="client-name-cell">
              <strong>{client.name}</strong>
              <small>{client.phone || "Телефон не указан"}</small>
            </span>
            <div className="client-card-meta">
              <span data-label="Статус">
                <b
                  className={`client-status ${
                    (client.status || "Активный") === "Новый"
                      ? "client-status-new"
                      : "client-status-active"
                  }`}>
                  {client.status || "Активный"}
                </b>
              </span>
              <span data-label="Визитов">{client.visitsCount}</span>
              <span data-label="Не был">
                {client.daysAbsent === null
                  ? "Новый"
                  : `${client.daysAbsent} дн.`}
              </span>
            </div>
            <span data-label="Пакеты">
              {client.packagesCount} / {client.packagesLeft}
            </span>
            <span data-label="Сумма">{formatMoney(client.totalIncome)}</span>
            <span data-label="Последний визит">{client.lastVisit}</span>
            <span data-label="Заметка">{client.note || "—"}</span>

            <div
              className="client-mobile-quick-actions"
              onClick={(event) => event.stopPropagation()}>
              <button
                aria-label={`Написать ${client.name}`}
                className="client-quick-action"
                type="button"
                onClick={() => onMessageClient(client)}>
                <MessageSquareText size={14} />
                <span>Написать</span>
              </button>
              <button
                aria-label={`Записать ${client.name}`}
                className="client-quick-action"
                type="button"
                onClick={() => onAddVisit(client)}>
                <CalendarPlus size={14} />
                <span>Запись</span>
              </button>
            </div>

            <div
              className="row-actions row-action-trigger-wrap client-row-actions"
              onClick={(event) => event.stopPropagation()}>
              <button
                className="row-action row-action-trigger"
                aria-label="Действия"
                onClick={() =>
                  setOpenClientMenuId(
                    openClientMenuId === client.id ? null : client.id,
                  )
                }>
                <MoreVertical size={18} />
              </button>

              {openClientMenuId === client.id && (
                <div className="row-action-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setViewedClient(client);
                      setVisitHistoryTab("future");
                      setOpenClientMenuId(null);
                    }}>
                    <Eye size={15} />
                    Посмотреть
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenClientMenuId(null);
                      onMessageClient(client);
                    }}>
                    <MessageSquareText size={15} />
                    Написать
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenClientMenuId(null);
                      onAddToWaitlist?.(client);
                    }}>
                    <Clock3 size={15} />
                    Лист ожидания
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenClientMenuId(null);
                      onEditClient(client);
                    }}>
                    <Pencil size={15} />
                    Редактировать
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenClientMenuId(null);
                      onDeleteClient(client);
                    }}>
                    <Trash2 size={15} />
                    Удалить
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filteredClients.length === 0 && (
          <div className="clients-empty">
            <strong>Клиенты не найдены</strong>
            <span>Попробуйте изменить запрос или очистить поиск.</span>
          </div>
        )}
      </div>
      {activeViewedClient && (
        <MobileSheet
          className="employee-modal client-details-modal"
          fullscreen={isMobile}
          isOpen
          labelledBy="client-card-title"
          title={activeViewedClient.name}
          description="Карточка клиента"
          onClose={() => setViewedClient(null)}
          footer={
            <div className="client-details-actions">
              <button
                className="submit-button"
                type="button"
                onClick={() => onAddVisit(activeViewedClient)}>
                <CalendarPlus size={15} />
                Добавить визит
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => onMessageClient(activeViewedClient)}>
                <MessageSquareText size={15} />
                Написать
              </button>
              <a
                aria-disabled={!activeViewedClient.phone}
                className="secondary-button"
                href={
                  activeViewedClient.phone ? `tel:${activeViewedClient.phone}` : undefined
                }>
                <Phone size={15} />
                Позвонить
              </a>
            </div>
          }>
          <div className="client-details-body client-details-sheet-root">
            <div className="client-details-grid">
              <span>
                Телефон <strong>{activeViewedClient.phone || "—"}</strong>
              </span>
              <span>
                Email <strong>{activeViewedClient.email || "—"}</strong>
              </span>
              <span>
                Instagram <strong>{activeViewedClient.instagram || "—"}</strong>
              </span>
              <span>
                Telegram <strong>{activeViewedClient.telegram || "—"}</strong>
              </span>
              <span>
                Дата рождения <strong>{activeViewedClient.birthday || "—"}</strong>
              </span>
              <span>
                Источник <strong>{activeViewedClient.source || "—"}</strong>
              </span>
              <span>
                Визитов <strong>{activeViewedClient.visitsCount}</strong>
              </span>
              <span>
                Завершено <strong>{activeViewedClient.completedVisitsCount}</strong>
              </span>
              <span>
                Запланировано{" "}
                <strong>{activeViewedClient.upcomingVisitsCount}</strong>
              </span>
              <span>
                Последний визит <strong>{activeViewedClient.lastVisit}</strong>
              </span>
              <span>
                Не был{" "}
                <strong>
                  {activeViewedClient.daysAbsent === null
                    ? "Еще не приходил"
                    : `${activeViewedClient.daysAbsent} дн.`}
                </strong>
              </span>
              <span>
                Пакетов <strong>{activeViewedClient.packagesCount}</strong>
              </span>
              <span>
                Остаток сеансов <strong>{activeViewedClient.packagesLeft}</strong>
              </span>
              {activeViewedClient.archivedPackagesCount > 0 ? (
                <span>
                  В архиве <strong>{activeViewedClient.archivedPackagesCount}</strong>
                </span>
              ) : null}
              <span>
                Общая сумма{" "}
                <strong>{formatMoney(activeViewedClient.totalIncome)}</strong>
              </span>
              <span>
                Предпочтения <strong>{activeViewedClient.preference || "—"}</strong>
                {" · "}
                Язык SMS{" "}
                <strong>{activeViewedClient.messageLanguage || "Польский"}</strong>
              </span>
              <span>
                Статус <strong>{activeViewedClient.status || "Активный"}</strong>
              </span>
              <span>
                Теги <strong>{activeViewedClient.tags || "—"}</strong>
              </span>
            </div>
            {activeViewedClient.birthday && (
              <div className="client-birthday-note">
                <CakeSlice size={15} />
                Дата рождения участвует в уведомлениях CRM.
              </div>
            )}
            <div className="client-details-note">
              <span>Заметка</span>
              <textarea
                key={`${activeViewedClient.id}-${activeViewedClient.note || ""}`}
                className="client-details-note-input"
                defaultValue={activeViewedClient.note || ""}
                placeholder="Заметок пока нет."
                rows={3}
                onBlur={(event) => {
                  const nextNote = event.target.value.trim();
                  const currentNote = String(activeViewedClient.note || "").trim();

                  if (nextNote === currentNote) {
                    return;
                  }

                  onUpdateClientNote(activeViewedClient, nextNote);
                }}
              />
            </div>
            <div className="client-visit-history">
              <div>
                <span>История визитов</span>
                <b>{activeViewedClient.appointments.length}</b>
              </div>
              <div className="client-visit-history-tabs">
                <button
                  className={visitHistoryTab === "future" ? "active" : ""}
                  type="button"
                  onClick={() => setVisitHistoryTab("future")}>
                  Будущие
                  <b>{activeViewedClient.upcomingVisitsCount}</b>
                </button>
                <button
                  className={visitHistoryTab === "past" ? "active" : ""}
                  type="button"
                  onClick={() => setVisitHistoryTab("past")}>
                  Прошлые
                  <b>
                    {activeViewedClient.appointments.length -
                      activeViewedClient.upcomingVisitsCount}
                  </b>
                </button>
              </div>
              <div className="client-visit-history-table">
                <div className="client-visit-history-row client-visit-history-head">
                  <span>Дата</span>
                  <span>Услуга</span>
                  <span>Мастер</span>
                  <span>Оплата</span>
                  <span>Прибыль</span>
                  <span>Статус</span>
                  <span></span>
                </div>
                {activeViewedClient.appointments
                  .filter((appointment) =>
                    visitHistoryTab === "future"
                      ? appointment.status === "Запланирован"
                      : appointment.status !== "Запланирован",
                  )
                  .map((appointment) => (
                    <div
                      className="client-visit-history-row"
                      key={appointment.id}>
                      <span data-label="Дата">
                        {appointment.date}
                        {appointment.time !== "—"
                          ? ` · ${appointment.time}`
                          : ""}
                      </span>
                      <span data-label="Услуга">{appointment.service}</span>
                      <span data-label="Мастер">{appointment.master}</span>
                      <span data-label="Оплата">{appointment.payment}</span>
                      <span data-label="Прибыль">
                        {appointment.total === null
                          ? "После визита"
                          : formatMoney(appointment.total)}
                      </span>
                      <span data-label="Статус">
                        <b>{appointment.status}</b>
                      </span>
                      <button
                        className="client-repeat-visit"
                        type="button"
                        onClick={() =>
                          onRepeatVisit(activeViewedClient, appointment)
                        }>
                        <RotateCcw size={13} />
                        Повторить визит
                      </button>
                    </div>
                  ))}
                {activeViewedClient.appointments.filter((appointment) =>
                  visitHistoryTab === "future"
                    ? appointment.status === "Запланирован"
                    : appointment.status !== "Запланирован",
                ).length === 0 && (
                  <p className="client-visit-history-empty">
                    {visitHistoryTab === "future"
                      ? "Будущих визитов пока нет."
                      : "Прошлых визитов пока нет."}
                  </p>
                )}
              </div>
            </div>
            <div className="client-communications">
              <span>Последние сообщения</span>
              {viewedClientCommunications.map((entry) => (
                <article key={entry.id}>
                  <div>
                    <strong>{entry.channel}</strong>
                    <small>
                      {new Date(entry.createdAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                  <p>{entry.templateName}</p>
                </article>
              ))}
              {viewedClientCommunications.length === 0 && (
                <p className="client-communications-empty">
                  Сообщений пока не отправляли.
                </p>
              )}
            </div>
          </div>
        </MobileSheet>
      )}
    </section>
  );
}

function getAppointmentStatus(entry) {
  if (entry.status === "cancelled") return "Отменён";
  if (entry.status === "no_show") return "Не пришёл";
  if (entry.status === "completed") return "Окончен";

  const end = new Date(`${entry.date}T${entry.time || "00:00"}:00`);
  end.setMinutes(end.getMinutes() + Number(entry.duration || 0));

  return end < new Date() ? "Окончен" : "Запланирован";
}

export default ClientsPage;
