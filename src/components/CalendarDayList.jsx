import {useState} from "react";
import VisitMobileCard from "./VisitMobileCard.jsx";
import {Button, EmptyState} from "./ui/index.js";

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
  onViewReserved,
}) {
  const [openVisitMenuId, setOpenVisitMenuId] = useState(null);
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
      <section className="py-10 px-4">
        <EmptyState
          action={
            <Button leftIcon="calendarPlus" size="sm" type="button" variant="primary" onClick={onAdd}>
              Добавить визит
            </Button>
          }
          className="border-transparent bg-transparent p-0"
          description="На этот день записей пока нет."
          icon="calendar"
          title="Пустой день"
        />
      </section>
    );
  }

  return (
    <section aria-label="Записи на день" className="flex flex-col gap-3">
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
          openMenuId={openVisitMenuId}
          setOpenMenuId={setOpenVisitMenuId}
        />
      ))}
      {reservedEntries.map((entry) => (
        <Button
          className="calendar-reserved-mobile-card"
          key={entry.id}
          type="button"
          variant="ghost"
          onClick={() => onViewReserved?.(entry)}
        >
          <div className="flex justify-between items-start w-full gap-4">
            <div className="flex flex-col min-w-0">
              <strong className="text-orange-400 text-xs font-semibold">{entry.time}</strong>
              <span className="text-zinc-200 text-sm font-bold truncate mt-0.5">{entry.title || "Резерв"}</span>
            </div>
            <b className="text-zinc-400 text-xs font-medium">{entry.master}</b>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
            <span>Зарезервировано</span>
          </div>
        </Button>
      ))}
    </section>
  );
}

export default CalendarDayList;
