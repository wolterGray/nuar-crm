import {CalendarPlus} from "lucide-react";
import VisitMobileCard from "./VisitMobileCard.jsx";

function CalendarDayList({
  entries,
  clients,
  nextVisitId,
  onAdd,
  onEdit,
  onDelete,
  onRemind,
  onStatus,
  onViewClient,
}) {
  const visitEntries = entries
    .filter((entry) => entry.kind === "visit")
    .sort((first, second) => String(first.time).localeCompare(String(second.time)));

  const reservedEntries = entries
    .filter((entry) => entry.kind === "reserved")
    .sort((first, second) => String(first.time).localeCompare(String(second.time)));

  const getClientPhone = (clientName) =>
    clients.find((client) => client.name === clientName)?.phone ?? null;

  if (visitEntries.length === 0 && reservedEntries.length === 0) {
    return (
      <section className="calendar-day-list calendar-day-list-empty">
        <p>На этот день записей пока нет.</p>
        <button className="add-visit-button calendar-day-list-add" type="button" onClick={onAdd}>
          <CalendarPlus size={17} />
          Добавить визит
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Записи на день" className="calendar-day-list">
      {visitEntries.map((entry) => (
        <VisitMobileCard
          clientPhone={getClientPhone(entry.client)}
          isNext={entry.id === nextVisitId}
          key={entry.id}
          showMaster
          showStatus
          visit={entry}
          onCancel={(item) => onStatus?.(item, "cancelled")}
          onConfirm={(item) => onStatus?.(item, "confirmed")}
          onEdit={onEdit}
          onDelete={onDelete}
          onMessage={onRemind}
          onOpen={onViewClient}
        />
      ))}
      {reservedEntries.map((entry) => (
        <article className="visit-mobile-card visit-mobile-card-reserved" key={entry.id}>
          <div className="visit-mobile-card-top">
            <div className="visit-mobile-card-time-block">
              <strong className="visit-mobile-card-time">{entry.time}</strong>
              <span className="visit-mobile-card-client">{entry.title || "Резерв"}</span>
            </div>
            <b className="visit-mobile-card-amount">{entry.master}</b>
          </div>
          <div className="visit-mobile-card-meta">
            <span>Зарезервировано</span>
          </div>
          <div className="visit-mobile-card-actions">
            <button className="client-quick-action" type="button" onClick={() => onEdit?.(entry)}>
              Изменить
            </button>
            <button
              className="client-quick-action visit-mobile-delete"
              type="button"
              onClick={() => onDelete?.(entry)}>
              Удалить
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

export default CalendarDayList;
