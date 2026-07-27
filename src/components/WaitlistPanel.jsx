import {memo, useCallback} from "react";
import PageHeader from "./PageHeader.jsx";
import {RowActionsMenu} from "./RowActionMenuPortal.jsx";
import {AppIcon, Button, EmptyState} from "./ui/index.js";
import {
  getActiveWaitlistEntries,
  summarizeWaitlistEntry,
} from "../utils/waitlist.js";

const WaitlistCard = memo(
  function WaitlistCard({
    entry,
    openMenuId,
    setOpenMenuId,
    onMessage,
    onBook,
    onEdit,
    onRemove,
  }) {
    const handleMessage = useCallback(() => {
      onMessage?.(entry);
    }, [onMessage, entry]);

    const handleBook = useCallback(() => {
      onBook?.(entry);
    }, [onBook, entry]);

    const handleEdit = useCallback(() => {
      onEdit?.(entry);
    }, [onEdit, entry]);

    const handleDelete = useCallback(() => {
      onRemove?.(entry);
    }, [onRemove, entry]);

    return (
      <article
        className="client-package-card waitlist-card certificate-card"
        key={entry.id}>
        <div className="operations-card-head">
          <span className="operations-card-icon waitlist-card-icon">
            <AppIcon name="clock" size="sm" />
          </span>
          <div className="operations-card-body">
            <strong>{entry.clientName}</strong>
            {entry.note ? (
              <span className="waitlist-row-note">{entry.note}</span>
            ) : null}
          </div>
          <RowActionsMenu
            className="operations-row-actions"
            itemId={`waitlist-${entry.id}`}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        </div>
        <div className="waitlist-meta">
          <span className="waitlist-meta-item">
            {summarizeWaitlistEntry(entry)}
          </span>
        </div>
        <div className="waitlist-card-actions">
          <Button
            className="waitlist-action-button"
            leftIcon="message"
            size="sm"
            title="Шаблоны сообщений"
            variant="secondary"
            onClick={handleMessage}>
            Написать
          </Button>
          <Button
            className="waitlist-action-button"
            leftIcon="calendarPlus"
            size="sm"
            title="Новая запись"
            variant="secondary"
            onClick={handleBook}>
            Записать
          </Button>
        </div>
      </article>
    );
  },
  (prev, next) => {
    // Custom comparison: memoize if critical data unchanged
    return (
      prev.entry.id === next.entry.id &&
      prev.entry.clientName === next.entry.clientName &&
      prev.entry.note === next.entry.note &&
      prev.entry.status === next.entry.status &&
      prev.entry.lastOfferedAt === next.entry.lastOfferedAt &&
      prev.openMenuId === next.openMenuId
    );
  }
);

function WaitlistPanel({
  openMenuId,
  setOpenMenuId,
  waitlistEntries = [],
  onAdd,
  onBook,
  onEdit,
  onMessage,
  onRemove,
}) {
  const activeEntries = getActiveWaitlistEntries(waitlistEntries);
  const offeredEntries = waitlistEntries.filter((entry) => entry.status === "offered");

  return (
    <section className="panel operations-panel waitlist-panel">
      <PageHeader
        description="Клиенты, которым можно предложить освободившийся слот"
        showNotifications={false}
        title="Лист ожидания"
      />
      <Button
        className="add-visit-button waitlist-add-button"
        leftIcon="plus"
        variant="primary"
        onClick={onAdd}>
        Добавить
      </Button>

      {activeEntries.length === 0 ? (
        <EmptyState
          className="operations-empty"
          icon="clock"
          title="Активных заявок пока нет."
        />
      ) : (
        <div className="client-packages-list">
          {activeEntries.map((entry) => (
            <WaitlistCard
              key={entry.id}
              entry={entry}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
              onMessage={onMessage}
              onBook={onBook}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      {offeredEntries.length > 0 ? (
        <div className="waitlist-offered-block">
          <strong>
            <AppIcon name="clock" size="sm" />
            Недавно предложено ({offeredEntries.length})
          </strong>
          <ul>
            {offeredEntries.slice(0, 5).map((entry) => (
              <li key={entry.id}>
                {entry.clientName}
                {entry.lastOfferedAt
                  ? ` · ${new Date(entry.lastOfferedAt).toLocaleDateString("ru-RU")}`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default WaitlistPanel;
