import { CalendarPlus } from "lucide-react";
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
      <section className="flex flex-col items-center justify-center py-12 px-4 border border-zinc-800 rounded-xl bg-zinc-900/30 text-center">
        <p className="text-zinc-500 text-sm mb-4">На этот день записей пока нет.</p>
        <button
          className="inline-flex items-center gap-2 min-h-[40px] px-5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer shadow-md shadow-indigo-950/20 transition-all"
          type="button"
          onClick={onAdd}
        >
          <CalendarPlus size={17} />
          Добавить визит
        </button>
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
        />
      ))}
      {reservedEntries.map((entry) => (
        <article
          className="p-4 border border-orange-500/20 rounded-xl bg-orange-500/5 flex flex-col gap-1.5"
          key={entry.id}
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
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800/40 w-full justify-end">
            <button
              className="inline-flex items-center px-3 py-1.5 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 hover:text-zinc-150 hover:bg-zinc-800 transition-colors cursor-pointer"
              type="button"
              onClick={() => onEdit?.(entry)}
            >
              Изменить
            </button>
            <button
              className="inline-flex items-center px-3 py-1.5 border border-red-505/20 rounded-lg text-xs font-semibold text-red-400 hover:text-white hover:bg-red-550 transition-colors cursor-pointer"
              type="button"
              onClick={() => onDelete?.(entry)}
            >
              Удалить
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}

export default CalendarDayList;
