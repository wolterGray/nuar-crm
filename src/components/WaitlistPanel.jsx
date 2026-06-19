import {CalendarPlus, Clock3, MessageSquareText, Plus} from "lucide-react";
import PageHeader from "./PageHeader.jsx";
import {RowActionsMenu} from "./RowActionMenuPortal.jsx";
import {
  getActiveWaitlistEntries,
  summarizeWaitlistEntry,
} from "../utils/waitlist.js";

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
        title="Лист ожидания">
        <button className="add-visit-button" type="button" onClick={onAdd}>
          <Plus size={16} />
          Добавить
        </button>
      </PageHeader>

      {activeEntries.length === 0 ? (
        <p className="operations-empty">Активных заявок пока нет.</p>
      ) : (
        <div className="client-packages-list">
          {activeEntries.map((entry) => (
            <article
              className="client-package-card waitlist-card certificate-card"
              key={entry.id}>
              <div className="operations-card-head">
                <span className="operations-card-icon waitlist-card-icon">
                  <Clock3 size={15} />
                </span>
                <div className="operations-card-body">
                  <strong>{entry.clientName}</strong>
                  {entry.note ? (
                    <span className="waitlist-row-note">{entry.note}</span>
                  ) : null}
                </div>
                <RowActionsMenu
                  className="operations-row-actions"
                  itemId={entry.id}
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                  onDelete={() => onRemove?.(entry)}
                  onEdit={() => onEdit?.(entry)}
                />
              </div>
              <div className="waitlist-meta">
                <span className="waitlist-meta-item">
                  {summarizeWaitlistEntry(entry)}
                </span>
              </div>
              <div className="waitlist-card-actions">
                <button
                  className="waitlist-action-button"
                  title="Шаблоны сообщений"
                  type="button"
                  onClick={() => onMessage?.(entry)}>
                  <MessageSquareText size={14} />
                  Написать
                </button>
                <button
                  className="waitlist-action-button"
                  title="Новая запись"
                  type="button"
                  onClick={() => onBook?.(entry)}>
                  <CalendarPlus size={14} />
                  Записать
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {offeredEntries.length > 0 ? (
        <div className="waitlist-offered-block">
          <strong>
            <Clock3 size={15} />
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
