import {memo, useCallback, useEffect, useMemo, useState} from "react";
import "./WaitlistPanel.css";
import WaitlistDetailDrawer from "./WaitlistDetailDrawer.jsx";
import {AppIcon, Badge, Button, EmptyState} from "./ui/index.js";
import {
  formatWaitlistDisplayDate,
  formatWaitlistDisplayTime,
  getActiveWaitlistEntries,
  getDeletedWaitlistEntries,
  getOfferedWaitlistEntries,
  isWaitlistEntryDeleted,
  parseWaitlistEntryDetails,
} from "../utils/waitlist.js";
import {formatMoney} from "../utils/formatters.jsx";

const WaitlistCard = memo(function WaitlistCard({
  clientProfiles,
  entry,
  onBook,
  onMessage,
  onOpenDetails,
  onRestore,
}) {
  const details = useMemo(
    () => parseWaitlistEntryDetails(entry, clientProfiles),
    [entry, clientProfiles],
  );

  const handleCardClick = useCallback(() => {
    onOpenDetails?.(entry);
  }, [entry, onOpenDetails]);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpenDetails?.(entry);
      }
    },
    [entry, onOpenDetails],
  );

  const handleMessageClick = useCallback(
    (event) => {
      event.stopPropagation();
      onMessage?.(entry);
    },
    [entry, onMessage],
  );

  const handleBookClick = useCallback(
    (event) => {
      event.stopPropagation();
      onBook?.(entry);
    },
    [entry, onBook],
  );

  const handleRestoreClick = useCallback(
    (event) => {
      event.stopPropagation();
      onRestore?.(entry.id);
    },
    [entry.id, onRestore],
  );

  return (
    <article
      aria-label={`Заявка от ${details.clientName}`}
      className={`waitlist-card ${details.isDeleted ? "waitlist-card-deleted" : ""}`}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      {/* 1. Header: Client Name & Status */}
      <div className="waitlist-card-head">
        <div className="waitlist-card-title-group">
          <h3 className="waitlist-card-client-name">{details.clientName}</h3>
          <div className="waitlist-card-source-row">
            <span className={`waitlist-source-pill waitlist-source-${details.source}`}>
              <AppIcon name={details.source === "site" ? "globe" : "user"} size="xs" />
              {details.sourceLabel}
            </span>
            {details.createdAt ? (
              <span className="waitlist-drawer-created">
                {new Date(details.createdAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            ) : null}
          </div>
        </div>
        <Badge size="sm" variant={details.statusBadge.variant}>
          {details.statusBadge.label}
        </Badge>
      </div>

      {/* 2. Main Slot: Preferred Date & Time */}
      <div className="waitlist-card-time-block">
        <AppIcon className="waitlist-card-time-icon" name="calendar" size="sm" />
        <span>
          {formatWaitlistDisplayDate(details.preferredDate)} ·{" "}
          {formatWaitlistDisplayTime(details.preferredTimeFrom, details.preferredTimeTo)}
        </span>
      </div>

      {/* 3. Detailed Parameter Chips: Service, Duration, Master */}
      <div className="waitlist-card-chips">
        <span className="waitlist-chip">
          <AppIcon className="waitlist-chip-icon" name="sparkles" size="xs" />
          <span>
            Услуга: <strong>{details.preferredService || "Любая"}</strong>
          </span>
        </span>
        {details.bookedPrice ? (
          <span className="waitlist-chip waitlist-chip-price">
            <AppIcon className="waitlist-chip-icon" name="banknote" size="xs" />
            <span>
              Цена: <strong>{formatMoney(details.bookedPrice)}</strong>
            </span>
          </span>
        ) : null}
        <span className="waitlist-chip">
          <AppIcon className="waitlist-chip-icon" name="clock" size="xs" />
          <span>{details.durationMinutes} мин</span>
        </span>
        <span className="waitlist-chip">
          <AppIcon className="waitlist-chip-icon" name="user" size="xs" />
          <span>
            Мастер: <strong>{details.preferredMaster || "Любой"}</strong>
          </span>
        </span>
      </div>

      {/* 4. Client Comment Snippet */}
      {details.clientComment ? (
        <p className="waitlist-card-note" title={details.clientComment}>
          💬 {details.clientComment}
        </p>
      ) : null}

      {/* 5. Footer: Quick Actions & Open Hint */}
      <div className="waitlist-card-foot">
        <div className="waitlist-card-actions">
          {details.isDeleted ? (
            <Button
              leftIcon="refreshCw"
              size="sm"
              variant="secondary"
              onClick={handleRestoreClick}
            >
              Восстановить
            </Button>
          ) : (
            <>
              <Button
                leftIcon="messageSquare"
                size="sm"
                variant="ghost"
                onClick={handleMessageClick}
              >
                Связаться
              </Button>
              <Button
                leftIcon="calendarPlus"
                size="sm"
                variant="secondary"
                onClick={handleBookClick}
              >
                Записать
              </Button>
            </>
          )}
        </div>
        <span className="waitlist-card-open-hint">
          Детали <AppIcon name="chevronRight" size="xs" />
        </span>
      </div>
    </article>
  );
});

function WaitlistPanel({
  alertFocus,
  clientProfiles = [],
  waitlistEntries = [],
  onAdd,
  onBook,
  onEdit,
  onMessage,
  onRemove,
  onRestore,
  onAlertFocusHandled,
}) {
  const [filter, setFilter] = useState("active");
  const [selectedEntryId, setSelectedEntryId] = useState(null);

  // Group entries by status
  const activeEntries = useMemo(
    () => getActiveWaitlistEntries(waitlistEntries),
    [waitlistEntries],
  );
  const offeredEntries = useMemo(
    () => getOfferedWaitlistEntries(waitlistEntries),
    [waitlistEntries],
  );
  const deletedEntries = useMemo(
    () => getDeletedWaitlistEntries(waitlistEntries),
    [waitlistEntries],
  );
  const allNonDeletedEntries = useMemo(
    () => waitlistEntries.filter((item) => !isWaitlistEntryDeleted(item)),
    [waitlistEntries],
  );

  // Determine current active item for detail drawer
  const selectedEntry = useMemo(
    () => waitlistEntries.find((item) => item.id === selectedEntryId) || null,
    [waitlistEntries, selectedEntryId],
  );

  useEffect(() => {
    if (alertFocus?.type !== "waitlist" || !alertFocus.entityId) return;
    const focusedEntry = waitlistEntries.find(
      (entry) => String(entry.id) === String(alertFocus.entityId),
    );
    if (!focusedEntry) return;
    const timer = window.setTimeout(() => {
      setFilter(isWaitlistEntryDeleted(focusedEntry) ? "deleted" : "all");
      setSelectedEntryId(focusedEntry.id);
      onAlertFocusHandled?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [alertFocus, onAlertFocusHandled, waitlistEntries]);

  // Visible entries depending on active tab
  const visibleEntries = useMemo(() => {
    switch (filter) {
      case "offered":
        return offeredEntries;
      case "deleted":
        return deletedEntries;
      case "all":
        return allNonDeletedEntries;
      case "active":
      default:
        return activeEntries;
    }
  }, [filter, activeEntries, offeredEntries, deletedEntries, allNonDeletedEntries]);

  const handleOpenDetails = useCallback((entry) => {
    setSelectedEntryId(entry.id);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedEntryId(null);
  }, []);

  return (
    <div className="waitlist-panel-container">
      {/* 1. Header Toolbar with Title, Badge, and Add Action */}
      <div className="waitlist-toolbar">
        <div className="waitlist-toolbar-top">
          <div className="waitlist-toolbar-title-group">
            <h2 className="waitlist-toolbar-title">Очередь заявок</h2>
            {activeEntries.length > 0 ? (
              <Badge size="sm" variant="danger">
                {activeEntries.length}
              </Badge>
            ) : null}
          </div>
          <Button
            className="waitlist-add-btn"
            leftIcon="plus"
            size="sm"
            variant="primary"
            onClick={onAdd}
          >
            Добавить
          </Button>
        </div>
        <p className="waitlist-toolbar-subtitle">
          Онлайн-бронирования с сайта и клиенты листа ожидания
        </p>

        {/* 2. Filter Tabs Bar */}
        <div className="waitlist-filters-bar" role="tablist">
          <button
            className={`waitlist-filter-chip ${filter === "active" ? "is-active" : ""}`}
            type="button"
            onClick={() => setFilter("active")}
          >
            <span>Активные</span>
            <span className="waitlist-filter-chip-count">{activeEntries.length}</span>
          </button>
          <button
            className={`waitlist-filter-chip ${filter === "offered" ? "is-active" : ""}`}
            type="button"
            onClick={() => setFilter("offered")}
          >
            <span>Предложено</span>
            <span className="waitlist-filter-chip-count">{offeredEntries.length}</span>
          </button>
          <button
            className={`waitlist-filter-chip ${filter === "all" ? "is-active" : ""}`}
            type="button"
            onClick={() => setFilter("all")}
          >
            <span>Все</span>
            <span className="waitlist-filter-chip-count">{allNonDeletedEntries.length}</span>
          </button>
          {deletedEntries.length > 0 ? (
            <button
              className={`waitlist-filter-chip ${filter === "deleted" ? "is-active" : ""}`}
              type="button"
              onClick={() => setFilter("deleted")}
            >
              <span>Удалённые</span>
              <span className="waitlist-filter-chip-count">{deletedEntries.length}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* 3. Cards List or Empty State */}
      {visibleEntries.length === 0 ? (
        <EmptyState
          className="waitlist-empty-state"
          icon={filter === "deleted" ? "trash" : "clock"}
          title={
            filter === "active"
              ? "Активных заявок пока нет"
              : filter === "offered"
              ? "Нет заявок со статусом «Предложено»"
              : filter === "deleted"
              ? "Корзина удалённых заявок пуста"
              : "Заявок не найдено"
          }
          description={
            filter === "active"
              ? "Новые онлайн-заявки с сайта и клиенты из листа ожидания появятся здесь."
              : undefined
          }
        />
      ) : (
        <div className="waitlist-cards-list">
          {visibleEntries.map((entry) => (
            <WaitlistCard
              key={entry.id}
              clientProfiles={clientProfiles}
              entry={entry}
              onBook={onBook}
              onMessage={onMessage}
              onOpenDetails={handleOpenDetails}
              onRestore={onRestore}
            />
          ))}
        </div>
      )}

      {/* 4. Full Detail Drawer (Mobile Bottom Sheet / Desktop Side Drawer) */}
      <WaitlistDetailDrawer
        clientProfiles={clientProfiles}
        entry={selectedEntry}
        isOpen={Boolean(selectedEntry)}
        onBook={onBook}
        onClose={handleCloseDetails}
        onEdit={onEdit}
        onMessage={onMessage}
        onRemove={onRemove}
        onRestore={onRestore}
      />
    </div>
  );
}

export default WaitlistPanel;
