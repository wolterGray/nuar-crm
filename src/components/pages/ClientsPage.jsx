import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./ClientsPage.css";
import {
  formatMoney,
  getDaysSinceDisplayDate,
  getLatestDisplayDate,
  toDisplayDate,
  toInputDate,
} from "../../utils/formatters.jsx";
import { getVisitTotal } from "../../utils/visits.jsx";
import { matchesClientRecord } from "../../utils/clientLinks.js";
import { buildClientQualityReport } from "../../utils/clientQuality.js";
import {
  isActiveClientPackage,
  isArchivedClientPackage,
} from "../../utils/clientPackages.js";
import {
  getActiveCertificatesForClient,
} from "../../utils/certificates.js";
import PageHeader from "../PageHeader.jsx";
import MobileSheet from "../MobileSheet.jsx";
import Button from "../ui/Button.jsx";
import Select from "../ui/Select.jsx";
import Textarea from "../ui/Textarea.jsx";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";
import ClientList from "./clients/ClientList.jsx";
import ClientWorkspace from "./clients/ClientWorkspace.jsx";
import ClientQualityPanel from "./clients/ClientQualityPanel.jsx";

function getClientInitials(name) {
  if (!name || typeof name !== "string") return "—";
  const trimmed = name.trim();
  if (!trimmed) return "—";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
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

function getAppointmentStatus(entry) {
  if (entry.status === "cancelled") return "Отменён";
  if (entry.status === "no_show") return "Не пришёл";
  if (entry.status === "completed") return "Окончен";

  const end = new Date(`${entry.date}T${entry.time || "00:00"}:00`);
  end.setMinutes(end.getMinutes() + Number(entry.duration || 0));

  return end < new Date() ? "Окончен" : "Запланирован";
}

function getClientAutoStatus(
  visitsCount,
  daysAbsent,
  inactiveClientDays = 14,
  hasFutureAppointments = false,
) {
  const count = Number(visitsCount) || 0;
  if (count <= 1) {
    return "Новый";
  }
  if (hasFutureAppointments) {
    return "Активный";
  }
  if (daysAbsent === null || daysAbsent === undefined) {
    return "Новый";
  }
  if (daysAbsent <= inactiveClientDays) {
    return "Активный";
  }
  if (daysAbsent <= 45) {
    return "Редко";
  }
  return "Давно";
}

function getClientAutoVip(visitsCount, totalIncome) {
  return (Number(visitsCount) || 0) >= 10 || (Number(totalIncome) || 0) >= 2000;
}

function ClientsPage({
  alertFocus,
  calendarEntries = [],
  clients = [],
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
  onUpdateClientNote,
  appSettings,
}) {
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [drawerClient, setDrawerClient] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const closeTimerRef = useRef(null);

  const [openClientMenuId, setOpenClientMenuId] = useState(null);
  const [messageBuilderClient, setMessageBuilderClient] = useState(null);
  const [messageLanguage, setMessageLanguage] = useState("pl");
  const [messageText, setMessageText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("remind");
  const [copiedState, setCopiedState] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("recent");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState(null); // 'active' | 'vip' | 'note' | 'debt' | null
  const [page, setPage] = useState(1);
  const [showQuality, setShowQuality] = useState(false);
  const pageSize = 20;

  const { isMobile } = useBreakpoint();

  const getTemplates = useCallback((clientName, lang = "pl") => {
    const name = clientName || (lang === "pl" ? "kliencie" : lang === "en" ? "client" : "клиент");
    const reviewUrl = appSettings?.reviewGoogleUrl || "https://g.page/r/YOUR_GOOGLE_LINK/review";

    const dict = {
      pl: {
        remind: {
          name: "Напоминание о записи",
          text: `Cześć ${name}! Przypominamy o Twojej wizycie в salonie NUAR. Czekamy na Ciebie!`,
        },
        reactivate: {
          name: "Давно не виделись",
          text: `Cześć ${name}! Dawno się nie widzieliśmy w salonie NUAR. Chętnie pomożemy dobrać dogodny termin na kolejną wizytę.`,
        },
        review: {
          name: "Запрос отзыва",
          text: `Cześć ${name}! Dziękujemy za wizytę w NUAR. Będziemy wdzięczni za krótką opinię na Google: ${reviewUrl}`,
        },
      },
      ru: {
        remind: {
          name: "Напоминание о записи",
          text: `Здравствуйте, ${name}! Напоминаем о вашей записи в салон NUAR. Ждём вас!`,
        },
        reactivate: {
          name: "Давно не виделись",
          text: `Здравствуйте, ${name}! Давно вас не видели в салоне NUAR. Будем рады подобрать для вас удобное время для визита!`,
        },
        review: {
          name: "Запрос отзыва",
          text: `Здравствуйте, ${name}! Спасибо за визит в салон NUAR. Будем очень благодарны за ваш отзыв в Google: ${reviewUrl}`,
        },
      },
      ua: {
        remind: {
          name: "Напоминание о записи",
          text: `Вітаємо, ${name}! Нагадуємо про ваш запис у салон NUAR. Чекаємо на вас!`,
        },
        reactivate: {
          name: "Давно не виделись",
          text: `Вітаємо, ${name}! Давно не бачилися в салоні NUAR. З радістю допоможемо обрати зручний час для наступного візиту!`,
        },
        review: {
          name: "Запрос отзыва",
          text: `Вітаємо, ${name}! Дякуємо за візит до NUAR. Будемо щиро вдячні за ваш відгук у Google: ${reviewUrl}`,
        },
      },
      en: {
        remind: {
          name: "Напоминание о записи",
          text: `Hello ${name}! Reminding you about your upcoming appointment at NUAR salon. We look forward to seeing you!`,
        },
        reactivate: {
          name: "Давно не виделись",
          text: `Hello ${name}! It's been a while since your last visit to NUAR salon. We'd love to help you book your next session!`,
        },
        review: {
          name: "Запрос отзыва",
          text: `Hello ${name}! Thank you for visiting NUAR salon. We would really appreciate your quick review on Google: ${reviewUrl}`,
        },
      },
    };

    return dict[lang] || dict.pl;
  }, [appSettings]);

  const handleMessageClient = useCallback((client) => {
    const rawLang = String(client.messageLanguage || client.language || "").toLowerCase();
    let initialLang = "pl";
    if (rawLang.includes("рус") || rawLang.includes("ru")) initialLang = "ru";
    else if (rawLang.includes("укр") || rawLang.includes("ua")) initialLang = "ua";
    else if (rawLang.includes("англ") || rawLang.includes("en")) initialLang = "en";

    setMessageLanguage(initialLang);
    const templates = getTemplates(client.name, initialLang);
    setSelectedTemplate("remind");
    setMessageText(templates.remind.text);
    setCopiedState(false);
    setMessageBuilderClient(client);
  }, [getTemplates]);

  const handleAddVisit = useCallback((client) => {
    onAddVisit?.({
      client: client.name,
      clientId: client.id,
      date: new Date().toISOString().slice(0, 10),
      kind: "visit",
    });
  }, [onAddVisit]);

  const handleAddToWaitlist = useCallback((client) => {
    handleAddVisit(client);
  }, [handleAddVisit]);

  const handleRepeatVisit = useCallback((client, appointment) => {
    onAddVisit?.({
      client: client.name,
      clientId: client.id,
      ...appointment.repeatDefaults,
    });
  }, [onAddVisit]);

  const handleSearchChange = useCallback((event) => {
    setSearch(event.target.value);
    setPage(1);
    setOpenClientMenuId(null);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearch("");
    setPage(1);
  }, []);

  // 1. Data calculation per client
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

        // Debt calculation
        const journalDebt = clientVisits.reduce(
          (sum, visit) => sum + (Number(visit.debt) || 0),
          0,
        );
        const calendarDebt = scheduledEntries.reduce(
          (sum, entry) => sum + (Number(entry.debt) || 0),
          0,
        );
        const totalDebt = journalDebt + calendarDebt + (Number(client.debt) || 0);
        const hasDebt = totalDebt > 0;
        const hasNote = Boolean(client.note && String(client.note).trim() !== "");

        return {
          ...client,
          visitsCount: appointments.length,
          autoStatus: getClientAutoStatus(
            appointments.length,
            daysAbsent,
            inactiveClientDays || 14,
            futureAppointments.length > 0,
          ),
          isVip: getClientAutoVip(appointments.length, totalIncome) || Boolean(client.isVip || client.vip),
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
          totalDebt,
          hasDebt,
          hasNote,
        };
      }),
    [calendarEntries, certificates, clientPackages, clients, employees, visits],
  );

  const clientQualityReport = useMemo(
    () => buildClientQualityReport(clientsData),
    [clientsData],
  );

  // 2. Alert Focus Handling: opens drawer and focuses client
  useEffect(() => {
    if (!alertFocus?.entityId || alertFocus.type !== "client") {
      return undefined;
    }

    const client =
      clientsData.find(
        (item) =>
          String(item.id) === String(alertFocus.entityId) ||
          item.name === alertFocus.entityId,
      ) ?? null;

    const setupTimer = window.setTimeout(() => {
      if (client) {
        setSelectedClientId(client.id);
        setDrawerClient(client);
        setIsDrawerOpen(true);
      }

      document
        .getElementById(`alert-focus-client-${alertFocus.entityId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);

    const clearTimer = window.setTimeout(() => {
      onAlertFocusHandled?.();
    }, 4500);

    return () => {
      window.clearTimeout(setupTimer);
      window.clearTimeout(clearTimer);
    };
  }, [alertFocus, clientsData, onAlertFocusHandled]);

  const isFocusedClient = useCallback((client) =>
    alertFocus?.type === "client" &&
    (String(alertFocus.entityId) === String(client.id) ||
      alertFocus.entityId === client.name), [alertFocus]);

  // 3. Quick indicator counts
  const indicatorCounts = useMemo(() => {
    let active = 0;
    let vip = 0;
    let withNote = 0;
    let withDebt = 0;

    for (const client of clientsData) {
      if (client.autoStatus === "Активный") active += 1;
      if (client.isVip) vip += 1;
      if (client.hasNote) withNote += 1;
      if (client.hasDebt) withDebt += 1;
    }

    return { all: clientsData.length, active, vip, withNote, withDebt };
  }, [clientsData]);

  // 4. Filtering & Sorting
  const normalizedSearch = search.trim().toLowerCase();
  const normalizedPhoneSearch = search.replace(/\D/g, "");

  const filteredClients = useMemo(() => clientsData.filter((client) => {
    const searchableText = [
      client.name,
      client.phone,
      client.email,
      client.birthday,
      client.instagram,
      client.telegram,
      client.note,
      client.source,
      client.preference,
      client.autoStatus,
      client.tags,
      client.lastVisit,
    ]
      .join(" ")
      .toLowerCase();

    const phoneMatches = normalizedPhoneSearch.length > 2
      && String(client.phone || "").replace(/\D/g, "").includes(normalizedPhoneSearch);
    const searchMatches = !normalizedSearch || searchableText.includes(normalizedSearch) || phoneMatches;
    if (!searchMatches) return false;

    // Status filter dropdown
    if (statusFilter !== "all" && client.autoStatus !== statusFilter) {
      return false;
    }

    // Quick filter pills
    if (quickFilter === "active" && client.autoStatus !== "Активный") {
      return false;
    }
    if (quickFilter === "vip" && !client.isVip) {
      return false;
    }
    if (quickFilter === "note" && !client.hasNote) {
      return false;
    }
    if (quickFilter === "debt" && !client.hasDebt) {
      return false;
    }

    // Segment dropdown filter
    if (segmentFilter === "vip" && !client.isVip) return false;
    if (segmentFilter === "packages" && client.packagesCount <= 0) return false;
    if (segmentFilter === "certificates" && client.activeCertificates.length <= 0) return false;
    if (segmentFilter === "inactive_30" && (client.daysAbsent === null || client.daysAbsent <= 30)) return false;
    if (segmentFilter === "inactive_90" && (client.daysAbsent === null || client.daysAbsent <= 90)) return false;
    if (segmentFilter === "new" && client.visitsCount > 0) return false;

    return true;
  }).sort((first, second) => {
    if (sortOrder === "name") return String(first.name || "").localeCompare(String(second.name || ""), "ru");
    if (sortOrder === "income") return second.totalIncome - first.totalIncome;
    if (sortOrder === "oldest") {
      return (second.daysAbsent ?? -1) - (first.daysAbsent ?? -1);
    }
    return (first.daysAbsent ?? Number.MAX_SAFE_INTEGER) - (second.daysAbsent ?? Number.MAX_SAFE_INTEGER);
  }), [clientsData, normalizedPhoneSearch, normalizedSearch, quickFilter, segmentFilter, sortOrder, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedClients = filteredClients.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Keep drawer client updated if client data changes
  const activeSelectedClient = useMemo(() => {
    if (!selectedClientId) return null;
    return clientsData.find((c) => c.id === selectedClientId) ?? null;
  }, [clientsData, selectedClientId]);

  useEffect(() => {
    if (activeSelectedClient) {
      setDrawerClient(activeSelectedClient);
    }
  }, [activeSelectedClient]);

  // Drawer Opening & Closing Logic
  const handleSelectClient = useCallback((client) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setSelectedClientId(client.id);
    setDrawerClient(client);
    setIsDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setSelectedClientId(null);
      setDrawerClient(null);
    }, 220);
  }, []);

  // Escape key closes drawer
  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleCloseDrawer();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, handleCloseDrawer]);

  const headerActions = (
    <div className="clients-header-actions flex items-center gap-2">
      <Button
        aria-label="Анализ базы"
        className="flex-1 sm:flex-initial"
        leftIcon="barChart"
        size={isMobile ? "sm" : "md"}
        variant="secondary"
        onClick={() => setShowQuality(!showQuality)}>
        <span>{isMobile ? "Анализ" : "Анализ базы"}</span>
      </Button>
      <Button
        className="flex-1 sm:flex-initial"
        leftIcon="plus"
        size={isMobile ? "sm" : "md"}
        variant="primary"
        onClick={onAddClient}>
        <span>{isMobile ? "Добавить" : "Добавить клиента"}</span>
      </Button>
    </div>
  );

  return (
    <section
      className="clients-page-container flex flex-col h-full w-full min-h-0 bg-background text-foreground overflow-visible"
      onClick={() => setOpenClientMenuId(null)}>
      {/* 1. Main Page Header */}
      <PageHeader
        actions={isMobile ? headerActions : null}
        className="clients-page-header shrink-0"
        headerActions={isMobile ? null : headerActions}
        title={
          <span className="flex items-center gap-2">
            <span>Клиенты</span>
            <span className="text-textMuted text-sm font-normal">({clients.length})</span>
          </span>
        }
      />

      {/* 2. Quality Analysis Modal Sheet (Eliminates scroll-in-scroll) */}
      {showQuality && (
        <MobileSheet
          className="clients-quality-sheet w-full md:max-w-2xl max-h-[85vh] p-0 overflow-hidden flex flex-col"
          description={`${clientQualityReport.score}% чистоты базы • ${clientQualityReport.issuesCount} пунктов требуют внимания`}
          fullscreen={isMobile}
          isOpen
          title="Анализ качества базы"
          onClose={() => setShowQuality(false)}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <ClientQualityPanel
              report={clientQualityReport}
              onClose={() => setShowQuality(false)}
              onEditClient={(client) => {
                setShowQuality(false);
                onEditClient?.(client);
              }}
              onOpenClient={(client) => {
                setShowQuality(false);
                handleSelectClient(client);
              }}
            />
          </div>
        </MobileSheet>
      )}

      {/* 3. Full-Width Client List Pane */}
      <div className="clients-main-workspace-area relative flex-1 min-h-0 w-full overflow-hidden">
        <ClientList
          clients={paginatedClients}
          formatMoney={formatMoney}
          getClientInitials={getClientInitials}
          handleAddToWaitlist={handleAddToWaitlist}
          handleMessageClient={handleMessageClient}
          inactiveClientDays={inactiveClientDays}
          indicatorCounts={indicatorCounts}
          isFocusedClient={isFocusedClient}
          onAddClient={onAddClient}
          onClearSearch={handleClearSearch}
          onDeleteClient={onDeleteClient}
          onEditClient={onEditClient}
          onPageChange={setPage}
          onQuickFilterChange={(filter) => {
            setQuickFilter(filter);
            setPage(1);
          }}
          onSearchChange={handleSearchChange}
          onSegmentFilterChange={(e) => {
            setSegmentFilter(e.target.value);
            setPage(1);
          }}
          onSelectClient={handleSelectClient}
          onSortOrderChange={(e) => {
            setSortOrder(e.target.value);
            setPage(1);
          }}
          onStatusFilterChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          openClientMenuId={openClientMenuId}
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          quickFilter={quickFilter}
          search={search}
          segmentFilter={segmentFilter}
          selectedClientId={selectedClientId}
          setOpenClientMenuId={setOpenClientMenuId}
          sortOrder={sortOrder}
          statusFilter={statusFilter}
          totalFilteredCount={filteredClients.length}
        />

        {/* 4. Right Side Drawer for Selected Client */}
        {drawerClient && (
          <div
            className={`client-drawer-backdrop ${isDrawerOpen ? "is-open" : "is-closing"}`}
            onClick={handleCloseDrawer}>
            <aside
              aria-label="Профиль клиента"
              className={`client-drawer-panel ${isDrawerOpen ? "is-open" : "is-closing"}`}
              role="dialog"
              onClick={(e) => e.stopPropagation()}>
              <ClientWorkspace
                client={drawerClient}
                communicationLog={communicationLog}
                formatAppointmentSummary={formatAppointmentSummary}
                formatMoney={formatMoney}
                getClientInitials={getClientInitials}
                handleAddToWaitlist={handleAddToWaitlist}
                handleRepeatVisit={handleRepeatVisit}
                isMobile={isMobile}
                onAddVisit={onAddVisit}
                onClose={handleCloseDrawer}
                onDeleteClient={(c) => {
                  handleCloseDrawer();
                  onDeleteClient?.(c);
                }}
                onEditClient={onEditClient}
                onMessageClient={handleMessageClient}
                onUpdateClientNote={onUpdateClientNote}
              />
            </aside>
          </div>
        )}
      </div>

      {/* 5. Message Builder Modal */}
      {messageBuilderClient && (
        <MobileSheet
          className="message-builder-modal w-full md:w-[480px] flex flex-col p-0 overflow-hidden"
          fullscreen={isMobile}
          isOpen
          title="Конструктор сообщений"
          description={`Связь с клиентом ${messageBuilderClient.name}`}
          onClose={() => setMessageBuilderClient(null)}
          footer={
            <div className="flex gap-2 w-full">
              <Button
                className="flex-1"
                leftIcon="send"
                variant="primary"
                onClick={() => {
                  navigator.clipboard.writeText(messageText);
                  setCopiedState(true);
                  setTimeout(() => setCopiedState(false), 2000);

                  const cleanTelegram = String(messageBuilderClient.telegram ?? "").trim().replace("@", "");
                  if (cleanTelegram) {
                    window.open(`https://t.me/${cleanTelegram}`, "_blank");
                  } else {
                    const cleanPhone = String(messageBuilderClient.phone ?? "").trim().replace(/\D/g, "");
                    if (cleanPhone) {
                      window.open(`https://t.me/+${cleanPhone}`, "_blank");
                    } else {
                      window.open("https://t.me", "_blank");
                    }
                  }
                }}>
                В Telegram
              </Button>
              <Button
                className="flex-1"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(messageText);
                  setCopiedState(true);
                  setTimeout(() => setCopiedState(false), 2000);
                }}>
                {copiedState ? "Скопировано!" : "Скопировать SMS"}
              </Button>
            </div>
          }>
          <div className="p-4 space-y-3.5">
            {/* Language Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-textMuted text-xs font-semibold">Язык сообщения</label>
              <div className="grid grid-cols-4 gap-1 p-0.5 rounded-xl bg-surface-2 border border-border/70">
                {[
                  { id: "pl", label: "🇵🇱 Polski" },
                  { id: "ru", label: "🇷🇺 Русский" },
                  { id: "ua", label: "🇺🇦 Українська" },
                  { id: "en", label: "🇬🇧 English" },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`h-7 rounded-lg text-xs font-semibold transition-all select-none ${
                      messageLanguage === l.id
                        ? "bg-surface text-textPrimary shadow-xs border border-white/10"
                        : "text-textMuted hover:text-textPrimary hover:bg-white/[0.03] border border-transparent"
                    }`}
                    onClick={() => {
                      setMessageLanguage(l.id);
                      const t = getTemplates(messageBuilderClient.name, l.id);
                      setMessageText(t[selectedTemplate]?.text ?? "");
                    }}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-textMuted text-xs font-semibold">Шаблон сообщения</label>
              <Select
                value={selectedTemplate}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTemplate(val);
                  const templates = getTemplates(messageBuilderClient.name, messageLanguage);
                  setMessageText(templates[val]?.text ?? "");
                }}>
                <option value="remind">Напоминание о записи</option>
                <option value="reactivate">Давно не виделись</option>
                <option value="review">Запрос отзыва</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-textMuted text-xs font-semibold">Текст сообщения</label>
              <Textarea
                className="w-full h-32 p-3 text-xs leading-relaxed"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
            </div>
          </div>
        </MobileSheet>
      )}
    </section>
  );
}

export default memo(ClientsPage);
