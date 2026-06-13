import {CalendarPlus, Clock3, MessageSquareText, Pencil, Plus, Trash2} from "lucide-react";
import PageHeader from "./PageHeader.jsx";
import {
  getActiveWaitlistEntries,
  summarizeWaitlistEntry,
} from "../utils/waitlist.js";

function WaitlistPanel({
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
            <article className="client-package-card certificate-card" key={entry.id}>
              <div className="client-package-main">
                <strong>{entry.clientName}</strong>
                <span>{summarizeWaitlistEntry(entry)}</span>
                {entry.note ? <small>{entry.note}</small> : null}
              </div>
              <div className="client-package-meta waitlist-card-actions">
                <button
                  aria-label="Написать"
                  className="secondary-button"
                  title="Шаблоны сообщений"
                  type="button"
                  onClick={() => onMessage?.(entry)}>
                  <MessageSquareText size={14} />
                </button>
                <button
                  aria-label="Записать"
                  className="secondary-button"
                  title="Новая запись"
                  type="button"
                  onClick={() => onBook?.(entry)}>
                  <CalendarPlus size={14} />
                </button>
                <button
                  aria-label="Редактировать"
                  className="secondary-button"
                  type="button"
                  onClick={() => onEdit?.(entry)}>
                  <Pencil size={14} />
                </button>
                <button
                  aria-label="Удалить"
                  className="secondary-button"
                  type="button"
                  onClick={() => onRemove?.(entry)}>
                  <Trash2 size={14} />
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
