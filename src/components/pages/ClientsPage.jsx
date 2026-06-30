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
import {buildClientQualityReport} from "../../utils/clientQuality.js";
import {
  isActiveClientPackage,
  isArchivedClientPackage,
} from "../../utils/clientPackages.js";
import {
  getActiveCertificatesForClient,
  getCertificateBalanceLabel,
} from "../../utils/certificates.js";
import PageHeader from "../PageHeader.jsx";
import MobileSheet from "../MobileSheet.jsx";
import SearchControl from "../ui/SearchControl.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {fetchClients} from "../../api/clients.js";

function ClientsPage({
  alertFocus,
  calendarEntries = [],
  clients: fallbackClients = [],
  clientPackages = [],
  certificates = [],
  communicationLog = [],
  employees = [],
  inactiveClientDays,
  visits = [],
  onAddClient,
  onAddVisit,
  onAlertFocusHandled,
  onDeleteClient,
  onEditClient,
  onMessageClient,
  onUpdateClientNote,
}) {
  const [openClientMenuId, setOpenClientMenuId] = useState(null);
  const [backendClients, setBackendClients] = useState([]);
  const [clientsLoadError, setClientsLoadError] = useState("");

  const clients = backendClients.length > 0 ? backendClients : fallbackClients;

  const handleMessageClient = (client) => {
    onMessageClient?.(client);
  };

  const handleAddVisit = (client) => {
    onAddVisit?.({
      client: client.name,
      clientId: client.id,
      date: new Date().toISOString().slice(0, 10),
      kind: "visit",
    });
  };

  const handleAddToWaitlist = (client) => {
    handleAddVisit(client);
  };

  const handleRepeatVisit = async (client, appointment) => {
    onAddVisit?.({
      client: client.name,
      clientId: client.id,
      ...appointment.repeatDefaults,
    });
  };

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const response = await fetchClients();

        if (!active) {
          return;
        }

        setBackendClients(Array.isArray(response?.data) ? response.data : []);
        setClientsLoadError("");
      } catch (e) {
        if (active) {
          setBackendClients([]);
          setClientsLoadError(e?.message || "Не удалось загрузить клиентов из backend");
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, []);
  const [viewedClient, setViewedClient] = useState(null);
  const [visitHistoryTab, setVisitHistoryTab] = useState("future");
  const [search, setSearch] = useState("");
  const {isMobile} = useBreakpoint();



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
        const activeCertificates = getActiveCertificatesForClient(
          certificates,
          clients,
          client,
        );
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
        const completedAppointments = appointments.filter(
          (appointment) => appointment.status !== "Запланирован",
        );
        const futureAppointments = appointments
          .filter((appointment) => appointment.status === "Запланирован")
          .sort((first, second) =>
            `${first.inputDate}T${first.time}`.localeCompare(
              `${second.inputDate}T${second.time}`,
            ),
          );
        const averageCheck =
          clientVisits.length > 0 ? Math.round(totalIncome / clientVisits.length) : 0;
        const favoriteService = getFavoriteService(completedAppointments);

        return {
          ...client,
          visitsCount: appointments.length,
          completedVisitsCount: clientVisits.length,
          upcomingVisitsCount: appointments.filter(
            (appointment) => appointment.status === "Запланирован",
          ).length,
          appointments,
          totalIncome,
          averageCheck,
          favoriteService,
          packagesCount: activePackages.length,
          activePackages,
          activeCertificates,
          activeCertificatesBalance: activeCertificates.reduce(
            (sum, certificate) => sum + (Number(certificate.remainingBalance) || 0),
            0,
          ),
          packagesLeft,
          archivedPackagesCount: packages.filter(isArchivedClientPackage).length,
          lastVisit,
          nextAppointment: futureAppointments[0] ?? null,
          daysAbsent,
        };
      }),
    [calendarEntries, certificates, clientPackages, clients, employees, visits],
  );
  const clientQualityReport = useMemo(
    () => buildClientQualityReport(clientsData),
    [clientsData],
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
      className="clients-page-shell flex flex-col h-full w-full min-h-0 overflow-hidden bg-background text-foreground"
      onClick={() => setOpenClientMenuId(null)}>
      <PageHeader
        className="clients-page-header"
        actions={
          <div className="clients-page-toolbar flex items-center gap-2 w-full md:w-auto">
            <SearchControl
              className="clients-page-search w-full md:w-64"
              placeholder="Поиск клиента"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOpenClientMenuId(null);
              }}
              onClear={() => setSearch("")}
            />
            <button
              className="clients-page-add-button inline-flex items-center justify-center gap-2 min-h-10 md:min-h-9 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover active:scale-95 transition-all text-sm cursor-pointer whitespace-nowrap"
              type="button"
              onClick={onAddClient}>
              <Plus size={16} />
              {isMobile ? "Добавить" : "Добавить клиента"}
            </button>
          </div>
        }
        description={isMobile ? undefined : `${filteredClients.length} из ${clients.length} в базе`}
        title="Клиенты"
      />

      {clientsLoadError ? (
        <p className="px-4 pb-2 text-xs text-muted-foreground">
          Backend clients недоступен, показаны текущие данные CRM.
        </p>
      ) : null}

      <ClientQualityPanel
        report={clientQualityReport}
        onEditClient={onEditClient}
        onOpenClient={(client) => {
          setViewedClient(client);
          setVisitHistoryTab("future");
        }}
      />

      <div className="clients-table-shell flex-1 min-h-0 overflow-y-auto pr-1 select-none scrollbar-thin scrollbar-thumb-accent scrollbar-track-transparent">
        {/* Table Head */}
        <div className="clients-table-head-row sticky top-0 z-10 hidden md:grid grid-cols-[minmax(180px,1.5fr)_110px_70px_90px_100px_130px_90px_minmax(120px,1fr)_50px] items-center gap-3 px-4 py-2 border-b border-border bg-card text-muted-foreground text-xs font-semibold uppercase tracking-wider">
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

        {/* Table Body */}
        <div className="clients-table-list grid gap-2 p-4 md:p-0">
          {filteredClients.map((client) => {
            const needsContact = client.daysAbsent === null || client.daysAbsent >= inactiveClientDays;
            return (
              <div
                className={`clients-table-item relative grid grid-cols-1 md:grid-cols-[minmax(180px,1.5fr)_110px_70px_90px_100px_130px_90px_minmax(120px,1fr)_50px] items-center gap-3 p-4 md:px-4 md:py-3 rounded-xl md:rounded-none border border-border md:border-0 md:border-b md:border-border bg-card md:bg-transparent hover:bg-accent/5 cursor-pointer transition-colors ${
                  needsContact ? "border-l-4 border-l-red-500 bg-red-500/5 md:bg-red-500/[0.03]" : ""
                } ${isFocusedClient(client) ? "animate-pulse ring-2 ring-accent" : ""}`}
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
                {/* Client info */}
                <div className="flex flex-col min-w-0 md:col-span-1">
                  <strong className="clients-table-name text-foreground font-bold text-sm md:text-base truncate">{client.name}</strong>
                  <small className="clients-table-phone text-muted-foreground text-xs truncate mt-0.5">{client.phone || "Телефон не указан"}</small>
                </div>

                {/* Mobile metadata / Status badge on Desktop */}
                <div className="flex flex-wrap items-center gap-2 md:contents">
                  <span data-label="Статус">
                    <b
                      className={`client-status-pill inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        (client.status || "Активный") === "Новый"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-green-500/10 text-green-500"
                      }`}>
                      {client.status || "Активный"}
                    </b>
                  </span>
                  <span className="inline-flex md:hidden items-center px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                    Визитов: {client.visitsCount}
                  </span>
                  <span className="inline-flex md:hidden items-center px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                    Не был: {client.daysAbsent === null ? "Новый" : `${client.daysAbsent} дн.`}
                  </span>
                </div>

                {/* Desktop metadata columns */}
                <span className="clients-table-number hidden md:inline text-foreground text-sm" data-label="Визитов">{client.visitsCount}</span>
                <span className="hidden md:inline text-foreground text-sm truncate" data-label="Пакеты">
                  {client.packagesCount} / {client.packagesLeft}
                </span>
                <span className="clients-table-money hidden md:inline text-foreground text-sm font-semibold" data-label="Сумма">{formatMoney(client.totalIncome)}</span>
                <span className="hidden md:inline text-foreground text-sm" data-label="Последний визит">{client.lastVisit}</span>
                <span className="hidden md:inline text-foreground text-sm" data-label="Не был">
                  {client.daysAbsent === null ? "Новый" : `${client.daysAbsent} дн.`}
                </span>
                <span className="hidden md:inline text-muted-foreground text-sm truncate" data-label="Заметка">{client.note || "—"}</span>

                {/* Mobile Quick Actions */}
                <div
                  className="flex md:hidden items-center gap-2 mt-2 w-full"
                  onClick={(event) => event.stopPropagation()}>
                  <button
                    aria-label={`Написать ${client.name}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-accent/5 font-semibold text-xs transition-all"
                    type="button"
                    onClick={() => handleMessageClient(client)}>
                    <MessageSquareText size={14} />
                    <span>Написать</span>
                  </button>
                  <button
                    aria-label={`Записать ${client.name}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-accent/5 font-semibold text-xs transition-all"
                    type="button"
                    onClick={() => handleAddVisit(client)}>
                    <CalendarPlus size={14} />
                    <span>Запись</span>
                  </button>
                </div>

                {/* Row actions */}
                <div
                  className="absolute top-4 right-4 md:relative md:top-auto md:right-auto flex justify-end"
                  onClick={(event) => event.stopPropagation()}>
                  <button
                    className="clients-row-menu-button inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-accent/10 active:scale-95 transition-all"
                    aria-label="Действия"
                    onClick={() =>
                      setOpenClientMenuId(
                        openClientMenuId === client.id ? null : client.id,
                      )
                    }>
                    <MoreVertical size={16} />
                  </button>

                  {openClientMenuId === client.id && (
                    <div className="clients-row-menu absolute right-0 top-10 md:top-8 z-20 w-48 rounded-lg border border-border bg-card p-1 shadow-lg">
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-left text-sm text-foreground hover:bg-accent/10 transition-colors"
                        type="button"
                        onClick={() => {
                          setViewedClient(client);
                          setVisitHistoryTab("future");
                          setOpenClientMenuId(null);
                        }}>
                        <Eye size={14} />
                        Посмотреть
                      </button>
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-left text-sm text-foreground hover:bg-accent/10 transition-colors"
                        type="button"
                        onClick={() => {
                          setOpenClientMenuId(null);
                          handleMessageClient(client);
                        }}>
                        <MessageSquareText size={14} />
                        Написать
                      </button>
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-left text-sm text-foreground hover:bg-accent/10 transition-colors"
                        type="button"
                        onClick={() => {
                          setOpenClientMenuId(null);
                          handleAddToWaitlist(client);
                        }}>
                        <Clock3 size={14} />
                        Лист ожидания
                      </button>
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-left text-sm text-foreground hover:bg-accent/10 transition-colors"
                        type="button"
                        onClick={() => {
                          setOpenClientMenuId(null);
                          onEditClient?.(client);
                        }}>
                        <Pencil size={14} />
                        Редактировать
                      </button>
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-left text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                        type="button"
                        onClick={() => {
                          setOpenClientMenuId(null);
                          onDeleteClient?.(client);
                        }}>
                        <Trash2 size={14} />
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredClients.length === 0 && (
          <div className="clients-empty-state flex flex-col items-center justify-center py-12 text-center select-none text-muted-foreground">
            <strong className="text-foreground font-bold text-lg mb-1">Клиенты не найдены</strong>
            <span className="text-sm">Попробуйте изменить запрос или очистить поиск.</span>
          </div>
        )}
      </div>

      {activeViewedClient && (
        <MobileSheet
          className="w-full md:w-[820px] max-h-[94dvh] md:max-h-[90dvh] flex flex-col p-0 overflow-hidden"
          fullscreen={isMobile}
          isOpen
          labelledBy="client-card-title"
          title={activeViewedClient.name}
          description="Карточка клиента"
          onClose={() => setViewedClient(null)}
          footer={
            <div className="grid grid-cols-3 gap-2 w-full">
              <button
                className="inline-flex items-center justify-center gap-1.5 min-h-10 px-4 py-2 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors text-xs cursor-pointer whitespace-nowrap"
                type="button"
                onClick={() => handleAddVisit(activeViewedClient)}>
                <CalendarPlus size={14} />
                Добавить визит
              </button>
              <button
                className="inline-flex items-center justify-center gap-1.5 min-h-10 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-accent/5 transition-colors text-xs font-semibold"
                type="button"
                onClick={() => handleMessageClient(activeViewedClient)}>
                <MessageSquareText size={14} />
                Написать
              </button>
              <a
                aria-disabled={!activeViewedClient.phone}
                className="inline-flex items-center justify-center gap-1.5 min-h-10 px-4 py-2 rounded-lg border border-border text-foreground hover:bg-accent/5 transition-colors text-xs font-semibold decoration-none whitespace-nowrap aria-[disabled=true]:opacity-50 aria-[disabled=true]:pointer-events-none"
                href={
                  activeViewedClient.phone ? `tel:${activeViewedClient.phone}` : undefined
                }>
                <Phone size={14} />
                Позвонить
              </a>
            </div>
          }>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 select-none scrollbar-thin scrollbar-thumb-accent scrollbar-track-transparent">
            {/* Overview cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <article className="flex flex-col gap-1 p-3 rounded-xl bg-muted">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Следующая запись</span>
                <strong className="text-foreground text-xs md:text-sm font-bold truncate">{formatAppointmentSummary(activeViewedClient.nextAppointment)}</strong>
                <small className="text-[10px] text-muted-foreground truncate">
                  {activeViewedClient.nextAppointment?.service ||
                    "Можно записать в один клик"}
                </small>
              </article>
              <article className="flex flex-col gap-1 p-3 rounded-xl bg-muted">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Любимая услуга</span>
                <strong className="text-foreground text-xs md:text-sm font-bold truncate">{activeViewedClient.favoriteService}</strong>
                <small className="text-[10px] text-muted-foreground truncate">{activeViewedClient.completedVisitsCount} завершено</small>
              </article>
              <article className="flex flex-col gap-1 p-3 rounded-xl bg-muted">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Средний чек</span>
                <strong className="text-foreground text-xs md:text-sm font-bold truncate">{formatMoney(activeViewedClient.averageCheck)}</strong>
                <small className="text-[10px] text-muted-foreground truncate">Всего {formatMoney(activeViewedClient.totalIncome)}</small>
              </article>
              <article className="flex flex-col gap-1 p-3 rounded-xl bg-muted">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Активы клиента</span>
                <strong className="text-foreground text-xs md:text-sm font-bold truncate">
                  {activeViewedClient.packagesLeft} сеанс. ·{" "}
                  {formatMoney(activeViewedClient.activeCertificatesBalance)}
                </strong>
                <small className="text-[10px] text-muted-foreground truncate">
                  {activeViewedClient.packagesCount} пак. ·{" "}
                  {activeViewedClient.activeCertificates.length} серт.
                </small>
              </article>
            </div>

            {/* Assets */}
            {(activeViewedClient.activePackages.length > 0 ||
              activeViewedClient.activeCertificates.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {activeViewedClient.activePackages.length > 0 ? (
                  <section className="flex flex-col gap-2 p-3 rounded-xl bg-muted">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Активные пакеты</span>
                    {activeViewedClient.activePackages.slice(0, 3).map((packageItem) => (
                      <p key={packageItem.id} className="flex justify-between items-center text-sm border-t border-border/40 pt-2 mt-1">
                        <strong className="font-bold text-foreground truncate">{packageItem.packageName || "Пакет"}</strong>
                        <small className="text-muted-foreground">{packageItem.remainingVisits} сеанс. осталось</small>
                      </p>
                    ))}
                  </section>
                ) : null}
                {activeViewedClient.activeCertificates.length > 0 ? (
                  <section className="flex flex-col gap-2 p-3 rounded-xl bg-muted">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Активные сертификаты</span>
                    {activeViewedClient.activeCertificates
                      .slice(0, 3)
                      .map((certificate) => (
                        <p key={certificate.id} className="flex justify-between items-center text-sm border-t border-border/40 pt-2 mt-1">
                          <strong className="font-bold text-foreground truncate">{certificate.code || "Сертификат"}</strong>
                          <small className="text-muted-foreground">{getCertificateBalanceLabel(certificate)}</small>
                        </p>
                      ))}
                  </section>
                ) : null}
              </div>
            )}

            {/* Client parameters grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Телефон <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.phone || "—"}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Email <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.email || "—"}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Instagram <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.instagram || "—"}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Telegram <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.telegram || "—"}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Дата рождения <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.birthday || "—"}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Источник <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.source || "—"}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Визитов <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.visitsCount}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Завершено <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.completedVisitsCount}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Запланировано <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.upcomingVisitsCount}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Последний визит <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.lastVisit}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Не был <strong className="text-foreground text-sm font-semibold truncate mt-1">
                  {activeViewedClient.daysAbsent === null
                    ? "Еще не приходил"
                    : `${activeViewedClient.daysAbsent} дн.`}
                </strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Пакетов <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.packagesCount}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Остаток сеансов <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.packagesLeft}</strong>
              </span>
              {activeViewedClient.archivedPackagesCount > 0 ? (
                <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                  В архиве <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.archivedPackagesCount}</strong>
                </span>
              ) : null}
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Общая сумма <strong className="text-foreground text-sm font-semibold truncate mt-1">{formatMoney(activeViewedClient.totalIncome)}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground col-span-2 md:col-span-3">
                Предпочтения <strong className="text-foreground text-sm font-semibold truncate mt-1">
                  {activeViewedClient.preference || "—"} · Язык SMS: {activeViewedClient.messageLanguage || "Польский"}
                </strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                Статус <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.status || "Активный"}</strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground col-span-2">
                Теги <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.tags || "—"}</strong>
              </span>
            </div>

            {activeViewedClient.birthday && (
              <div className="flex items-center gap-2 p-3 rounded-lg text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 text-xs">
                <CakeSlice size={15} />
                Дата рождения участвует в уведомлениях CRM.
              </div>
            )}

            {/* Note */}
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground font-semibold">Заметка</span>
              <textarea
                key={`${activeViewedClient.id}-${activeViewedClient.note || ""}`}
                className="w-full min-h-20 p-3 rounded-lg border border-border bg-muted text-foreground text-sm resize-y focus:outline-none focus:border-accent focus:bg-card transition-all"
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

            {/* Visit History */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span className="font-semibold">История визитов</span>
                <b className="flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-muted text-foreground font-bold">{activeViewedClient.appointments.length}</b>
              </div>
              <div className="flex justify-center gap-1 p-1 rounded-lg bg-muted">
                <button
                  className={`flex-1 inline-flex items-center justify-center gap-2 min-h-9 px-3 rounded-md text-xs font-semibold transition-all ${
                    visitHistoryTab === "future" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground bg-transparent"
                  }`}
                  type="button"
                  onClick={() => setVisitHistoryTab("future")}>
                  Будущие
                  <b className="text-[10px]">{activeViewedClient.upcomingVisitsCount}</b>
                </button>
                <button
                  className={`flex-1 inline-flex items-center justify-center gap-2 min-h-9 px-3 rounded-md text-xs font-semibold transition-all ${
                    visitHistoryTab === "past" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground bg-transparent"
                  }`}
                  type="button"
                  onClick={() => setVisitHistoryTab("past")}>
                  Прошлые
                  <b className="text-[10px]">
                    {activeViewedClient.appointments.length -
                      activeViewedClient.upcomingVisitsCount}
                  </b>
                </button>
              </div>
              <div className="h-64 overflow-y-auto border border-border rounded-lg scrollbar-thin select-none">
                {/* History Header */}
                <div className="sticky top-0 z-10 hidden md:grid grid-cols-[100px_minmax(130px,1fr)_80px_80px_90px_80px_90px] gap-2 items-center px-3 py-2 bg-muted text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  <span>Дата</span>
                  <span>Услуга</span>
                  <span>Мастер</span>
                  <span>Оплата</span>
                  <span>Прибыль</span>
                  <span>Статус</span>
                  <span></span>
                </div>
                {/* History rows */}
                <div className="divide-y divide-border/40">
                  {activeViewedClient.appointments
                    .filter((appointment) =>
                      visitHistoryTab === "future"
                        ? appointment.status === "Запланирован"
                        : appointment.status !== "Запланирован",
                    )
                    .map((appointment) => (
                      <div
                        className="grid grid-cols-1 md:grid-cols-[100px_minmax(130px,1fr)_80px_80px_90px_80px_90px] gap-2 items-center p-3 md:px-3 md:py-2 text-xs text-foreground bg-card md:bg-transparent"
                        key={appointment.id}>
                        <span className="font-semibold md:font-normal" data-label="Дата">
                          {appointment.date}
                          {appointment.time !== "—"
                            ? ` · ${appointment.time}`
                            : ""}
                        </span>
                        <span className="truncate" data-label="Услуга">{appointment.service}</span>
                        <span className="truncate" data-label="Мастер">{appointment.master}</span>
                        <span className="truncate" data-label="Оплата">{appointment.payment}</span>
                        <span className="font-semibold" data-label="Прибыль">
                          {appointment.total === null
                            ? "После визита"
                            : formatMoney(appointment.total)}
                        </span>
                        <span data-label="Статус">
                          <b className="font-bold text-muted-foreground">{appointment.status}</b>
                        </span>
                        <button
                          className="inline-flex items-center justify-center gap-1 min-h-[26px] px-2 rounded-md border border-border text-foreground hover:bg-accent/5 font-semibold text-[10px] transition-all cursor-pointer whitespace-nowrap w-full md:w-auto"
                          type="button"
                          onClick={() =>
                            handleRepeatVisit(activeViewedClient, appointment)
                          }>
                          <RotateCcw size={10} />
                          Повторить
                        </button>
                      </div>
                    ))}
                  {activeViewedClient.appointments.filter((appointment) =>
                    visitHistoryTab === "future"
                      ? appointment.status === "Запланирован"
                      : appointment.status !== "Запланирован",
                  ).length === 0 && (
                    <p className="p-4 text-center text-muted-foreground text-xs">
                      {visitHistoryTab === "future"
                        ? "Будущих визитов пока нет."
                        : "Прошлых визитов пока нет."}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Communications */}
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground font-semibold">Последние сообщения</span>
              <div className="space-y-2">
                {viewedClientCommunications.map((entry) => (
                  <article key={entry.id} className="flex justify-between items-center gap-2 p-3 rounded-lg bg-muted text-xs text-foreground">
                    <div className="flex flex-col gap-0.5">
                      <strong className="font-bold">{entry.channel}</strong>
                      <p className="text-muted-foreground text-[11px] mt-0.5">{entry.templateName}</p>
                    </div>
                    <small className="text-muted-foreground text-[10px] whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </article>
                ))}
                {viewedClientCommunications.length === 0 && (
                  <p className="p-3 text-center text-muted-foreground text-xs bg-muted rounded-lg">
                    Сообщений пока не отправляли.
                  </p>
                )}
              </div>
            </div>
          </div>
        </MobileSheet>
      )}
    </section>
  );
}

function getFavoriteService(appointments = []) {
  const serviceCounts = appointments.reduce((counts, appointment) => {
    const service = appointment.service || "Услуга не указана";

    counts.set(service, (counts.get(service) || 0) + 1);

    return counts;
  }, new Map());

  return (
    [...serviceCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ||
    "—"
  );
}

function formatAppointmentSummary(appointment) {
  if (!appointment) {
    return "Нет будущей записи";
  }

  return `${appointment.date}${appointment.time !== "—" ? ` · ${appointment.time}` : ""}`;
}

function ClientQualityPanel({report, onEditClient, onOpenClient}) {
  const topMissing = [
    ...report.missingPhone.map((client) => ({
      client,
      label: "Нет телефона",
    })),
    ...report.missingSource.map((client) => ({
      client,
      label: "Нет источника",
    })),
    ...report.missingMessageLanguage.map((client) => ({
      client,
      label: "Нет языка SMS",
    })),
  ].slice(0, 5);
  const duplicateGroups = [...report.duplicatePhones, ...report.duplicateNames].slice(
    0,
    4,
  );

  return (
    <section className="clients-quality-panel grid grid-cols-1 md:grid-cols-[0.8fr_1.2fr_1.4fr] gap-2 mb-2 p-4 md:p-0">
      {/* Quality Score */}
      <div className="clients-quality-card clients-quality-score flex flex-col gap-1 p-3 rounded-xl border border-border bg-card">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Качество базы</span>
        <strong className="text-foreground text-3xl font-extrabold leading-none mt-1">{report.score}%</strong>
        <small className="text-[10px] text-muted-foreground mt-2">
          {report.hasIssues
            ? `${report.issuesCount} пунктов к проверке`
            : "База выглядит чисто"}
        </small>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2">
        <article className="clients-quality-card flex flex-col justify-center p-3 rounded-xl border border-border bg-card">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Дубли телефонов</span>
          <strong className="text-foreground text-xl font-bold mt-1">{report.duplicatePhones.length}</strong>
        </article>
        <article className="clients-quality-card flex flex-col justify-center p-3 rounded-xl border border-border bg-card">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Дубли имён</span>
          <strong className="text-foreground text-xl font-bold mt-1">{report.duplicateNames.length}</strong>
        </article>
        <article className="clients-quality-card flex flex-col justify-center p-3 rounded-xl border border-border bg-card">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Без телефона</span>
          <strong className="text-foreground text-xl font-bold mt-1">{report.missingPhone.length}</strong>
        </article>
        <article className="clients-quality-card flex flex-col justify-center p-3 rounded-xl border border-border bg-card">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Без источника/SMS</span>
          <strong className="text-foreground text-xl font-bold mt-1">
            {report.missingSource.length + report.missingMessageLanguage.length}
          </strong>
        </article>
      </div>

      {/* Quality Lists */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Missing fields */}
        <div className="clients-quality-card flex flex-col gap-1.5 p-3 rounded-xl border border-border bg-card">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Быстро исправить</span>
          {topMissing.length > 0 ? (
            <div className="divide-y divide-border/40 overflow-y-auto max-h-36 pr-0.5">
              {topMissing.map((item) => (
                <button
                  key={`${item.label}-${item.client.id}`}
                  className="flex flex-col text-left py-1.5 w-full bg-transparent border-0 hover:text-accent group transition-colors cursor-pointer"
                  type="button"
                  onClick={() => onEditClient?.(item.client)}>
                  <strong className="text-xs text-foreground group-hover:text-accent font-semibold truncate w-full">{item.client.name}</strong>
                  <small className="text-[10px] text-muted-foreground truncate w-full">{item.label}</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">Критичных пропусков нет.</p>
          )}
        </div>

        {/* Duplicates */}
        <div className="clients-quality-card flex flex-col gap-1.5 p-3 rounded-xl border border-border bg-card">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Похожие клиенты</span>
          {duplicateGroups.length > 0 ? (
            <div className="divide-y divide-border/40 overflow-y-auto max-h-36 pr-0.5">
              {duplicateGroups.map((group) => (
                <button
                  key={group.key}
                  className="flex flex-col text-left py-1.5 w-full bg-transparent border-0 hover:text-accent group transition-colors cursor-pointer"
                  type="button"
                  onClick={() => onOpenClient(group.clients[0])}>
                  <strong className="text-xs text-foreground group-hover:text-accent font-semibold truncate w-full">{group.clients.map((client) => client.name).join(" / ")}</strong>
                  <small className="text-[10px] text-muted-foreground truncate w-full">{group.clients.length} записи · открыть первую</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">Дублей не найдено.</p>
          )}
        </div>
      </div>
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
