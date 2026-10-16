import {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import "./ClientsPage.css";
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
import RowActionMenuPortal from "../RowActionMenuPortal.jsx";
import AppIcon from "../ui/AppIcon.jsx";
import Button from "../ui/Button.jsx";
import IconButton from "../ui/IconButton.jsx";
import Select from "../ui/Select.jsx";
import Textarea from "../ui/Textarea.jsx";
import PaginationBar from "../ui/PaginationBar.jsx";
import {calculateDynamicPageSize} from "../../utils/pagination.js";
import {LoyaltyCard} from "../LoyaltyCardPreview.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {useRowActionMenu} from "../../hooks/useRowActionMenu.js";
import {getLoyaltyTierForCard} from "../../utils/loyaltyCardDesign.jsx";
import {
  fetchClientLoyaltyCard,
} from "../../api/loyalty.js";

function ClientRowActions({
  client,
  handleAddToWaitlist,
  handleMessageClient,
  onDeleteClient,
  onEditClient,
  openClientMenuId,
  setOpenClientMenuId,
  setViewedClient,
  setVisitHistoryTab,
}) {
  const isOpen = openClientMenuId === client.id;
  const {menuRef, menuStyle, triggerRef} = useRowActionMenu({
    isOpen,
    setOpenMenuId: setOpenClientMenuId,
  });

  const handleToggleMenu = useCallback(() => {
    setOpenClientMenuId(openClientMenuId === client.id ? null : client.id);
  }, [openClientMenuId, client.id, setOpenClientMenuId]);

  const handleViewClient = useCallback(() => {
    setViewedClient(client);
    setVisitHistoryTab("all");
    setOpenClientMenuId(null);
  }, [client, setViewedClient, setVisitHistoryTab, setOpenClientMenuId]);

  const handleMessage = useCallback(() => {
    setOpenClientMenuId(null);
    handleMessageClient(client);
  }, [client, handleMessageClient, setOpenClientMenuId]);

  const handleAddWaitlist = useCallback(() => {
    setOpenClientMenuId(null);
    handleAddToWaitlist(client);
  }, [client, handleAddToWaitlist, setOpenClientMenuId]);

  const handleEdit = useCallback(() => {
    setOpenClientMenuId(null);
    onEditClient?.(client);
  }, [client, onEditClient, setOpenClientMenuId]);

  const handleDelete = useCallback(() => {
    setOpenClientMenuId(null);
    onDeleteClient?.(client);
  }, [client, onDeleteClient, setOpenClientMenuId]);

  return (
    <div
      className="absolute top-4 right-4 md:relative md:top-auto md:right-auto flex justify-end"
      onClick={(event) => event.stopPropagation()}>
      <IconButton
        ref={triggerRef}
        aria-expanded={isOpen}
        className="clients-row-menu-button"
        icon="more"
        label="Действия"
        size="sm"
        variant="ghost"
        onClick={handleToggleMenu}
      />

      <RowActionMenuPortal
        isOpen={isOpen}
        menuRef={menuRef}
        menuStyle={menuStyle}>
        <div className="clients-row-menu">
          <Button
            className="clients-row-menu-item"
            leftIcon="eye"
            size="sm"
            variant="ghost"
            onClick={handleViewClient}>
            Посмотреть
          </Button>
          <Button
            className="clients-row-menu-item"
            leftIcon="message"
            size="sm"
            variant="ghost"
            onClick={handleMessage}>
            Написать
          </Button>
          <Button
            className="clients-row-menu-item"
            leftIcon="clock"
            size="sm"
            variant="ghost"
            onClick={handleAddWaitlist}>
            Лист ожидания
          </Button>
          <Button
            className="clients-row-menu-item"
            leftIcon="edit"
            size="sm"
            variant="ghost"
            onClick={handleEdit}>
            Редактировать
          </Button>
          <Button
            className="clients-row-menu-item danger"
            leftIcon="trash"
            size="sm"
            variant="danger"
            onClick={handleDelete}>
            Удалить
          </Button>
        </div>
      </RowActionMenuPortal>
    </div>
  );
}

const MemoizedClientRowActions = memo(ClientRowActions, (prev, next) => {
  return (
    prev.client.id === next.client.id &&
    prev.openClientMenuId === next.openClientMenuId &&
    prev.handleAddToWaitlist === next.handleAddToWaitlist &&
    prev.handleMessageClient === next.handleMessageClient &&
    prev.onDeleteClient === next.onDeleteClient &&
    prev.onEditClient === next.onEditClient &&
    prev.setOpenClientMenuId === next.setOpenClientMenuId &&
    prev.setViewedClient === next.setViewedClient &&
    prev.setVisitHistoryTab === next.setVisitHistoryTab
  );
});

function ClientLoyaltyCard({client}) {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadLoyalty = async () => {
    if (!client?.id) return;
    setLoading(true);
    setError("");
    try {
      const cardResponse = await fetchClientLoyaltyCard(client.id);
      const nextCard = cardResponse?.data ?? null;
      setCard(nextCard);
    } catch (err) {
      setError(err.message || "Не удалось загрузить карту");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      loadLoyalty();
    }, 0);
    return () => window.clearTimeout(loadTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  const clientVisits = Number(client.completedVisitsCount ?? client.visitsCount ?? 0) || 0;
  const previewCard = card
    ? {
      ...card,
      client: card.client || {name: client.name},
      displayName: card.displayName || client.name,
      lifetimeVisits: card.lifetimeVisits ?? card.totalVisits ?? clientVisits,
      totalVisits: card.totalVisits ?? card.lifetimeVisits ?? clientVisits,
    }
    : null;
  const activeTier = previewCard ? getLoyaltyTierForCard(previewCard) : null;

  return (
    <section className="client-loyalty-card">
      <div className="client-loyalty-header">
        <span className="client-loyalty-icon">
          <AppIcon name="shield" size="sm" />
        </span>
        <div>
          <strong>NUAR Club</strong>
          <small>Электронная карта лояльности</small>
        </div>
      </div>

      {error ? <p className="client-loyalty-error">{error}</p> : null}

      {!card ? (
        <p className="client-loyalty-empty">
          {loading ? "Загружаем карту..." : "Карта лояльности пока не создана."}
        </p>
      ) : (
        <div className="client-loyalty-preview">
          <LoyaltyCard card={previewCard} tier={activeTier} />
        </div>
      )}
    </section>
  );
}

function getClientInitials(name) {
  if (!name || typeof name !== "string") return "—";
  const trimmed = name.trim();
  if (!trimmed) return "—";
  if (trimmed.startsWith("+")) {
    return trimmed.slice(1, 2) || trimmed.slice(0, 1);
  }
  const parts = trimmed.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
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
  const [openClientMenuId, setOpenClientMenuId] = useState(null);
  const [messageBuilderClient, setMessageBuilderClient] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("remind");
  const [copiedState, setCopiedState] = useState(false);

  const getTemplates = useCallback((clientName) => ({
    remind: {
      name: "Напоминание о записи",
      text: `Cześć ${clientName || "kliencie"}! Przypominamy o Twojej wizycie w salonie NUAR. Czekamy na Ciebie!`,
    },
    reactivate: {
      name: "Давно не виделись",
      text: `Cześć ${clientName || "kliencie"}! Dawno się не widzieliśmy w salonie NUAR. Chętnie pomożemy dobrać dogodny termin na kolejną wizytę.`,
    },
    review: {
      name: "Запрос отзыва",
      text: `Cześć ${clientName || "kliencie"}! Dziękujemy za wizytę w NUAR. Będziemy wdzięczni za krótką opinię na Google: ${appSettings?.reviewGoogleUrl || "https://g.page/r/YOUR_GOOGLE_LINK/review"}`,
    }
  }), [appSettings]);

  const handleMessageClient = useCallback((client) => {
    const templates = getTemplates(client.name);
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

  const handleRepeatVisit = useCallback(async (client, appointment) => {
    onAddVisit?.({
      client: client.name,
      clientId: client.id,
      ...appointment.repeatDefaults,
    });
  }, [onAddVisit]);

  const [viewedClient, setViewedClient] = useState(null);
  const [visitHistoryTab, setVisitHistoryTab] = useState("all");
  const [clientCardTab, setClientCardTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("recent");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState(null); // 'active' | 'vip' | 'note' | 'debt' | null
  const [page, setPage] = useState(1);
  const tableShellRef = useRef(null);
  const [autoPageSize, setAutoPageSize] = useState(20);
  const [showQuality, setShowQuality] = useState(false);
  const returnFocusRef = useRef(null);
  const {isMobile} = useBreakpoint();

  useEffect(() => {
    const container = tableShellRef.current;
    if (!container) return undefined;

    const calculateCount = (height) => {
      const HEADER_HEIGHT = isMobile ? 0 : 34;
      const ROW_HEIGHT = isMobile ? 86 : 36;
      return calculateDynamicPageSize(height, HEADER_HEIGHT, ROW_HEIGHT, 10, 8);
    };

    const update = () => {
      const h = container.clientHeight;
      if (h > 0) {
        const count = calculateCount(h);
        setAutoPageSize((prev) => (prev !== count ? count : prev));
      }
    };

    update();

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const h = entry.contentRect.height;
          if (h > 0) {
            const count = calculateCount(h);
            setAutoPageSize((prev) => (prev !== count ? count : prev));
          }
        }
      });
      ro.observe(container);
    }

    window.addEventListener("resize", update);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [isMobile]);

  const pageSize = autoPageSize;

  // Memoized event handlers for client rows
  const handleViewClient = useCallback((client, trigger = null) => {
    returnFocusRef.current = trigger;
    setViewedClient(client);
    setVisitHistoryTab("all");
    setClientCardTab("overview");
  }, []);

  const handleMessageRow = useCallback((client) => {
    handleMessageClient(client);
  }, [handleMessageClient]);

  const handleAddVisitRow = useCallback((client) => {
    handleAddVisit(client);
  }, [handleAddVisit]);

  const handleCloseModal = useCallback(() => {
    setViewedClient(null);
    window.setTimeout(() => returnFocusRef.current?.focus?.(), 0);
  }, []);

  const handleSearchChange = useCallback((event) => {
    setSearch(event.target.value);
    setPage(1);
    setOpenClientMenuId(null);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearch("");
  }, []);



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

        // Debt calculation across journal visits and calendar entries
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
          autoStatus: getClientAutoStatus(appointments.length),
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

    return {active, vip, withNote, withDebt};
  }, [clientsData]);

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
    // "recent": most recent visit first (smallest daysAbsent first)
    return (first.daysAbsent ?? Number.MAX_SAFE_INTEGER) - (second.daysAbsent ?? Number.MAX_SAFE_INTEGER);
  }), [clientsData, normalizedPhoneSearch, normalizedSearch, quickFilter, segmentFilter, sortOrder, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedClients = filteredClients.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section
      className="clients-page-shell flex flex-col h-full w-full min-h-0 overflow-hidden bg-background text-foreground"
      onClick={() => setOpenClientMenuId(null)}>
      <PageHeader
        className="clients-page-header"
        headerActions={
          <div className="clients-page-actions">
              <Button
                aria-label="Анализ базы"
                className="clients-page-quality-button"
                leftIcon="barChart"
                variant="secondary"
                onClick={() => setShowQuality(!showQuality)}>
                <span>{isMobile ? "Анализ" : "Анализ базы"}</span>
              </Button>
              <Button
                className="clients-page-add-button"
                leftIcon="plus"
                variant="primary"
                onClick={onAddClient}>
                {isMobile ? "Добавить" : "Добавить клиента"}
              </Button>
          </div>
        }
        title={
          <span className="clients-title-line">
            Клиенты <span className="clients-title-counter">({clients.length})</span>
          </span>
        }
      />

      {showQuality && (
        <ClientQualityPanel
          report={clientQualityReport}
          onEditClient={onEditClient}
          onOpenClient={(client) => {
            setViewedClient(client);
            setVisitHistoryTab("all");
          }}
        />
      )}

      {/* 1. Filter Bar */}
      <div className="clients-filterbar">
        <div className="clients-search-wrap">
          <AppIcon className="clients-search-icon" name="search" size="xs" />
          <input
            className="clients-search-input"
            placeholder="Имя, телефон или заметка..."
            type="text"
            value={search}
            onChange={handleSearchChange}
          />
          {search ? (
            <button
              aria-label="Очистить поиск"
              className="clients-search-clear"
              type="button"
              onClick={handleClearSearch}
            >
              <AppIcon name="x" size="xs" />
            </button>
          ) : null}
        </div>

        <div className="clients-select-wrap">
          <AppIcon className="clients-select-lead-icon" name="sliders" size="xs" />
          <select
            aria-label="Статус клиента"
            className="clients-filter-select"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Все статусы</option>
            <option value="Активный">Активные</option>
            <option value="Новый">Новые</option>
          </select>
          <AppIcon className="clients-select-arrow" name="chevronDown" size="xs" />
        </div>

        <div className="clients-select-wrap">
          <AppIcon className="clients-select-lead-icon" name="calendar" size="xs" />
          <select
            aria-label="Сортировка"
            className="clients-filter-select"
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value);
              setPage(1);
            }}
          >
            <option value="recent">Последний визит ↓</option>
            <option value="oldest">Последний визит ↑</option>
            <option value="income">По сумме покупок</option>
            <option value="name">По имени (А–Я)</option>
          </select>
          <AppIcon className="clients-select-arrow" name="chevronDown" size="xs" />
        </div>

        <div className="clients-select-wrap">
          <AppIcon className="clients-select-lead-icon" name="filter" size="xs" />
          <select
            aria-label="Сегменты клиентов"
            className="clients-filter-select"
            value={segmentFilter}
            onChange={(event) => {
              setSegmentFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="all">Все сегменты</option>
            <option value="vip">VIP клиенты</option>
            <option value="packages">С активными пакетами</option>
            <option value="certificates">С сертификатами</option>
            <option value="inactive_30">Не были более 30 дней</option>
            <option value="inactive_90">Не были более 90 дней</option>
            <option value="new">Новые (без визитов)</option>
          </select>
          <AppIcon className="clients-select-arrow" name="chevronDown" size="xs" />
        </div>
      </div>

      {/* 2. Interactive Indicator Pills */}
      <div className="clients-indicator-pills">
        <button
          type="button"
          className={`clients-indicator-pill pill-active ${quickFilter === "active" ? "is-selected" : ""}`}
          onClick={() => {
            setQuickFilter((prev) => (prev === "active" ? null : "active"));
            setPage(1);
          }}
        >
          <span className="pill-dot pill-dot-green" />
          <span className="pill-label">Активные</span>
          <span className="pill-count">{indicatorCounts.active}</span>
        </button>

        <button
          type="button"
          className={`clients-indicator-pill pill-vip ${quickFilter === "vip" ? "is-selected" : ""}`}
          onClick={() => {
            setQuickFilter((prev) => (prev === "vip" ? null : "vip"));
            setPage(1);
          }}
        >
          <AppIcon name="crown" size="xs" className="pill-icon-gold" />
          <span className="pill-label">VIP</span>
          <span className="pill-count">{indicatorCounts.vip}</span>
        </button>

        <button
          type="button"
          className={`clients-indicator-pill pill-note ${quickFilter === "note" ? "is-selected" : ""}`}
          onClick={() => {
            setQuickFilter((prev) => (prev === "note" ? null : "note"));
            setPage(1);
          }}
        >
          <AppIcon name="fileText" size="xs" className="pill-icon-muted" />
          <span className="pill-label">С заметкой</span>
          <span className="pill-count">{indicatorCounts.withNote}</span>
        </button>

        <button
          type="button"
          className={`clients-indicator-pill pill-debt ${quickFilter === "debt" ? "is-selected" : ""}`}
          onClick={() => {
            setQuickFilter((prev) => (prev === "debt" ? null : "debt"));
            setPage(1);
          }}
        >
          <AppIcon name="ban" size="xs" className="pill-icon-red" />
          <span className="pill-label">С долгом</span>
          <span className="pill-count">{indicatorCounts.withDebt}</span>
        </button>
      </div>

      <div className="clients-table-shell" ref={tableShellRef}>
        {search.trim() && (
          <div className="px-4 py-2 text-xs text-muted-foreground font-medium border-b border-border/40 mb-2">
            Найдено результатов: <strong className="text-foreground">{filteredClients.length}</strong>
          </div>
        )}
        {/* Table Head */}
        <div className="clients-table-head-row">
          <div className="clients-col-client">Клиент</div>
          <div className="clients-col-status">Статус</div>
          <div className="clients-col-visits">Визиты</div>
          <div className="clients-col-money">Сумма</div>
          <div className="clients-col-last-visit">Последний визит</div>
          <div className="clients-col-note">Заметка</div>
          <div className="clients-col-actions">
            <AppIcon name="moreVertical" size="xs" className="clients-col-actions-header-icon" />
          </div>
        </div>

        {/* Table Body */}
        <div className="clients-table-list">
          {paginatedClients.map((client) => {
            const needsContact = client.daysAbsent === null || client.daysAbsent >= inactiveClientDays;
            return (
              <div
                className={`clients-table-item ${
                  needsContact ? "is-needs-contact" : ""
                } ${isFocusedClient(client) ? "animate-pulse ring-2 ring-accent" : ""}`}
                id={`alert-focus-client-${client.id}`}
                role="button"
                tabIndex="0"
                key={client.id}
                onClick={(event) => handleViewClient(client, event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleViewClient(client, event.currentTarget);
                  }
                }}>
                {/* Client info */}
                <div className="clients-col-client">
                  <span className="client-avatar">
                    {getClientInitials(client.name || client.phone)}
                  </span>
                  <span className="clients-client-name" title={client.name}>
                    {client.name || client.phone || "Без имени"}
                  </span>
                  {client.isVip && (
                    <span className="client-vip-tag">
                      <AppIcon name="crown" size="xs" />
                      VIP
                    </span>
                  )}
                  {client.phone && client.phone !== client.name ? (
                    <span className="clients-table-phone">
                      {client.phone}
                    </span>
                  ) : null}
                </div>

                {/* Status badge */}
                <div className="clients-col-status" data-label="Статус">
                  <span
                    className={`client-status-pill ${
                      client.autoStatus === "Новый" ? "status-new" : "status-active"
                    }`}>
                    {client.autoStatus}
                  </span>
                </div>

                {/* Mobile metadata tags */}
                <div className="clients-mobile-meta md:hidden">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-medium">
                    Визитов: {client.visitsCount}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs font-medium">
                    Не был: {client.daysAbsent === null ? "Новый" : `${client.daysAbsent} дн.`}
                  </span>
                </div>

                {/* Desktop metadata columns */}
                <div className="clients-col-visits hidden md:flex" data-label="Визиты">
                  <span className="clients-visits-num">{client.visitsCount}</span>
                  {client.visitsCount > 0 && (client.daysAbsent !== null && client.daysAbsent >= (inactiveClientDays || 30)) ? (
                    <span className="clients-churn-alert" title="Давно не был">
                      !
                    </span>
                  ) : null}
                  {client.packagesCount > 0 ? (
                    <AppIcon className="clients-active-package" name="package" size="xs" />
                  ) : null}
                </div>
                <div className="clients-col-money hidden md:flex" data-label="Сумма">
                  <span className="clients-money-amount">{formatMoney(client.totalIncome)}</span>
                </div>
                <div className="clients-col-last-visit hidden md:flex" data-label="Последний визит">
                  {client.lastVisit && client.lastVisit !== "—" ? (
                    <>
                      <span className="clients-last-visit-date">{client.lastVisit}</span>
                      {client.daysAbsent !== null ? (
                        <span className="clients-last-visit-days">
                          {` (${client.daysAbsent} дн.)`}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="clients-last-visit-empty">—</span>
                  )}
                </div>
                <div className="clients-col-note hidden md:flex" data-label="Заметка" title={client.note || ""}>
                  {client.hasNote ? (
                    <span className="clients-note-badge" title={client.note}>
                      <AppIcon name="fileText" size="xs" />
                      <span className="clients-note-text">Есть заметка</span>
                    </span>
                  ) : (
                    <span className="clients-note-empty">—</span>
                  )}
                </div>

                {/* Mobile Quick Actions */}
                <div
                  className="flex md:hidden items-center gap-2 mt-2 w-full"
                  onClick={(event) => event.stopPropagation()}>
                  <Button
                    aria-label={`Написать ${client.name}`}
                    className="client-action-write flex-1 inline-flex items-center justify-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg border font-semibold text-xs transition-all"
                    leftIcon="message"
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => handleMessageRow(client)}>
                    <span>Написать</span>
                  </Button>
                  <Button
                    aria-label={`Записать ${client.name}`}
                    className="client-action-record flex-1 inline-flex items-center justify-center gap-1.5 min-h-9 px-3 py-1.5 rounded-lg border font-semibold text-xs transition-all"
                    leftIcon="calendarPlus"
                    size="sm"
                    type="button"
                    variant="primary"
                    onClick={() => handleAddVisitRow(client)}>
                    <span>Запись</span>
                  </Button>
                </div>

                {/* Row actions */}
                <div className="clients-col-actions" onClick={(e) => e.stopPropagation()}>
                  <MemoizedClientRowActions
                    client={client}
                    handleAddToWaitlist={handleAddToWaitlist}
                    handleMessageClient={handleMessageClient}
                    onDeleteClient={onDeleteClient}
                    onEditClient={onEditClient}
                    openClientMenuId={openClientMenuId}
                    setOpenClientMenuId={setOpenClientMenuId}
                    setViewedClient={setViewedClient}
                    setVisitHistoryTab={setVisitHistoryTab}
                  />
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

      <PaginationBar
        autoPageSize={autoPageSize}
        className="shrink-0"
        currentPage={currentPage}
        itemLabel="клиентов"
        pageSize={pageSize}
        totalItems={filteredClients.length}
        totalPages={pageCount}
        onPageChange={setPage}
      />

      {activeViewedClient && (
        <MobileSheet
          className={`client-details-modal client-view-sheet client-tab-${clientCardTab}`}
          fullscreen={isMobile}
          isOpen
          labelledBy="client-card-title"
          title={<span className="client-card-title-line">{activeViewedClient.name}{activeViewedClient.isVip ? " VIP" : ""}<b className={`client-status-pill ${activeViewedClient.autoStatus === "Новый" ? "status-new" : "status-active"}`}>{activeViewedClient.autoStatus}</b></span>}
          description={activeViewedClient.phone || "Телефон не указан"}
          onClose={handleCloseModal}
          footer={
            <div className="client-card-footer-actions">
              <Button className="clients-modal-action" leftIcon="message" variant="secondary" onClick={() => handleMessageClient(activeViewedClient)}>Написать</Button>
              <a aria-disabled={!activeViewedClient.phone} className="clients-modal-action" href={activeViewedClient.phone ? `tel:${activeViewedClient.phone}` : undefined}><AppIcon name="phone" size="xs" />Позвонить</a>
              <Button className="clients-modal-action" leftIcon="edit" variant="secondary" onClick={() => onEditClient?.(activeViewedClient)}>Изменить</Button>
              <Button
                className="clients-modal-action is-primary"
                leftIcon="calendarPlus"
                variant="primary"
                onClick={() => handleAddVisit(activeViewedClient)}>
                Добавить визит
              </Button>
            </div>
          }>
          <div className="client-card-scroll">
            {/* Overview cards */}
            <div className="client-card-summary">
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

            <nav className="client-card-tabs" aria-label="Разделы карточки клиента">
              {[["overview", "Обзор"], ["visits", `Визиты ${activeViewedClient.appointments.length}`], ["packages", "Пакеты"], ["club", "NUAR Club"], ["data", "Данные"]].map(([value, label]) => (
                <button className={clientCardTab === value ? "is-active" : ""} key={value} type="button" onClick={() => setClientCardTab(value)}>{label}</button>
              ))}
            </nav>

            <div className="client-card-overview">
              <section className="client-overview-block">
                <header><AppIcon name="calendar" size="sm" /><strong>Следующая запись</strong></header>
                {activeViewedClient.nextAppointment ? (
                  <div className="client-next-appointment">
                    <b>{formatAppointmentSummary(activeViewedClient.nextAppointment)}</b>
                    <span>{activeViewedClient.nextAppointment.service}</span>
                  </div>
                ) : (
                  <div className="client-overview-empty"><b>Нет будущей записи</b><span>Можно записать в один клик</span></div>
                )}
              </section>
              <section className="client-overview-block">
                <header><AppIcon name="user" size="sm" /><strong>Предпочтения</strong></header>
                <dl className="client-preferences-list">
                  <div><dt>Мастер</dt><dd>{activeViewedClient.preference || "Любой мастер"}</dd></div>
                  <div><dt>Язык SMS</dt><dd>{activeViewedClient.messageLanguage || "Польский"}</dd></div>
                  <div><dt>Любимая услуга</dt><dd>{activeViewedClient.favoriteService}</dd></div>
                </dl>
              </section>
            </div>

            {/* Assets */}
            {(activeViewedClient.activePackages.length > 0 ||
              activeViewedClient.activeCertificates.length > 0) && (
              <div className="client-card-assets grid grid-cols-1 md:grid-cols-2 gap-2">
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
            <div className="client-card-data grid grid-cols-2 md:grid-cols-3 gap-2">
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
                Статус <strong className="text-foreground text-sm font-semibold truncate mt-1">
                  {activeViewedClient.autoStatus || getClientAutoStatus(activeViewedClient.visitsCount)}
                </strong>
              </span>
              <span className="flex flex-col gap-1 p-3 rounded-lg bg-muted text-xs text-muted-foreground col-span-2">
                Теги <strong className="text-foreground text-sm font-semibold truncate mt-1">{activeViewedClient.tags || "—"}</strong>
              </span>
            </div>

            {activeViewedClient.birthday && (
              <div className="client-card-data crm-alert crm-alert-warning flex items-center gap-2">
                <AppIcon name="cake" size="sm" />
                Дата рождения участвует в уведомлениях CRM.
              </div>
            )}

            <div className="client-card-club"><ClientLoyaltyCard client={activeViewedClient} key={activeViewedClient.id} /></div>

            {/* Note */}
            <div className="client-card-note flex flex-col gap-2">
              <span className="text-xs text-muted-foreground font-semibold">Заметка</span>
              <Textarea
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
            <div className="client-card-visits client-visit-history-section flex flex-col gap-3">
              <div className="client-visit-history-title flex justify-between items-center text-xs text-muted-foreground">
                <span className="font-semibold">История визитов</span>
                <b className="flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-muted text-foreground font-bold">{activeViewedClient.appointments.length}</b>
              </div>
              <div className="client-visit-history-tabs flex justify-center gap-1 p-1 rounded-lg bg-muted">
                <Button className={`client-visit-history-tab flex-1 ${visitHistoryTab === "all" ? "is-active" : ""}`} size="sm" variant="ghost" onClick={() => setVisitHistoryTab("all")}>Все <b>{activeViewedClient.appointments.length}</b></Button>
                <Button
                  className={`client-visit-history-tab flex-1 inline-flex items-center justify-center gap-2 min-h-9 px-3 rounded-md text-xs font-semibold transition-all ${
                    visitHistoryTab === "future" ? "is-active bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground bg-transparent"
                  }`}
                  size="sm"
                  variant="ghost"
                  onClick={() => setVisitHistoryTab("future")}>
                  Будущие
                  <b className="text-[10px]">{activeViewedClient.upcomingVisitsCount}</b>
                </Button>
                <Button
                  className={`client-visit-history-tab flex-1 inline-flex items-center justify-center gap-2 min-h-9 px-3 rounded-md text-xs font-semibold transition-all ${
                    visitHistoryTab === "past" ? "is-active bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground bg-transparent"
                  }`}
                  size="sm"
                  variant="ghost"
                  onClick={() => setVisitHistoryTab("past")}>
                  Прошлые
                  <b className="text-[10px]">
                    {activeViewedClient.appointments.length -
                      activeViewedClient.upcomingVisitsCount}
                  </b>
                </Button>
              </div>
              <div className="max-h-64 overflow-y-auto border border-border rounded-lg scrollbar-thin select-none">
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
                      visitHistoryTab === "all" ? true : visitHistoryTab === "future"
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
                        <Button
                          className="clients-repeat-visit-button"
                          leftIcon="rotateCcw"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            handleRepeatVisit(activeViewedClient, appointment)
                          }>
                          Повторить
                        </Button>
                      </div>
                    ))}
                  {activeViewedClient.appointments.filter((appointment) =>
                    visitHistoryTab === "all" ? true : visitHistoryTab === "future"
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
            <div className="client-card-communications flex flex-col gap-2">
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

      {messageBuilderClient && (
        <MobileSheet
          className="message-builder-modal w-full md:w-[500px] flex flex-col p-0 overflow-hidden"
          fullscreen={isMobile}
          isOpen
          title="Конструктор сообщений"
          description={`Связь с клиентом ${messageBuilderClient.name}`}
          onClose={() => setMessageBuilderClient(null)}
          footer={
            <div className="flex gap-2 w-full">
              <Button
                className="clients-message-action is-primary"
                leftIcon="message"
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
                Открыть Telegram
              </Button>
              <Button
                className="clients-message-action"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(messageText);
                  setCopiedState(true);
                  setTimeout(() => setCopiedState(false), 2000);
                }}>
                {copiedState ? "Скопировано!" : "Скопировать для SMS"}
              </Button>
            </div>
          }>
          <div className="p-5 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-muted-foreground text-xs font-semibold">Выберите шаблон</label>
              <Select
                className="w-full min-h-10 px-3 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-accent"
                value={selectedTemplate}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTemplate(val);
                  const templates = getTemplates(messageBuilderClient.name);
                  setMessageText(templates[val]?.text ?? "");
                }}>
                <option value="remind">Напоминание о записи</option>
                <option value="reactivate">Давно не виделись</option>
                <option value="review">Запрос отзыва</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-muted-foreground text-xs font-semibold">Текст сообщения</label>
              <Textarea
                className="w-full h-32 p-3 rounded-lg border border-border bg-surface text-foreground text-sm focus:outline-none focus:border-accent resize-none"
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
                <Button
                  key={`${item.label}-${item.client.id}`}
                  className="flex flex-col text-left py-1.5 w-full bg-transparent border-0 hover:text-accent group transition-colors cursor-pointer"
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditClient?.(item.client)}>
                  <strong className="text-xs text-foreground group-hover:text-accent font-semibold truncate w-full">{item.client.name}</strong>
                  <small className="text-[10px] text-muted-foreground truncate w-full">{item.label}</small>
                </Button>
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
                <Button
                  key={group.key}
                  className="flex flex-col text-left py-1.5 w-full bg-transparent border-0 hover:text-accent group transition-colors cursor-pointer"
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenClient(group.clients[0])}>
                  <strong className="text-xs text-foreground group-hover:text-accent font-semibold truncate w-full">{group.clients.map((client) => client.name).join(" / ")}</strong>
                  <small className="text-[10px] text-muted-foreground truncate w-full">{group.clients.length} записи · открыть первую</small>
                </Button>
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

function getClientAutoStatus(visitsCount) {
  return (Number(visitsCount) || 0) > 0 ? "Активный" : "Новый";
}

function getClientAutoVip(visitsCount, totalIncome) {
  return (Number(visitsCount) || 0) >= 10 || (Number(totalIncome) || 0) >= 2000;
}

export default ClientsPage;
