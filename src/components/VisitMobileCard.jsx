import {
  Ban,
  Check,
  MessageSquareText,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { formatMoney } from "../utils/formatters.jsx";
import { getVisitDebt, getVisitTransactionTotal } from "../utils/visits.jsx";
import { useBreakpoint } from "../hooks/useBreakpoint.js";
import { useSwipeReveal } from "../hooks/useSwipeReveal.js";
import { RowActionsMenu } from "./RowActionMenuPortal.jsx";

const statusLabels = {
  scheduled: "Запланирован",
  confirmed: "Подтверждён",
  completed: "Окончен",
  no_show: "Не пришёл",
  cancelled: "Отменён",
};

// Map payment type to modern Tailwind classes
const getPaymentBadgeStyles = (payment, debt) => {
  if (debt > 0) {
    return "text-red-400 bg-red-500/10 border-red-500/20";
  }
  const norm = String(payment || "").toLowerCase();
  if (norm.includes("пакет")) {
    return "text-purple-400 bg-purple-500/10 border-purple-500/20";
  }
  if (norm.includes("сертификат")) {
    return "text-amber-400 bg-amber-500/10 border-amber-500/20";
  }
  if (norm.includes("карт") || norm.includes("blik") || norm.includes("mono")) {
    return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  }
  if (norm.includes("налич")) {
    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  }
  if (norm.includes("крипт")) {
    return "text-teal-400 bg-teal-500/10 border-teal-500/20";
  }
  if (norm.includes("бартер")) {
    return "text-orange-400 bg-orange-500/10 border-orange-500/20";
  }
  return "text-amber-400 bg-amber-500/10 border-amber-500/20";
};

const getStatusBadgeStyles = (status) => {
  if (["cancelled", "no_show"].includes(status)) {
    return "text-red-400 bg-red-500/10 border-red-500/20";
  }
  if (status === "completed") {
    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  }
  return "text-blue-400 bg-blue-500/10 border-blue-500/20";
};

function VisitMobileCard({
  visit,
  clientPhone,
  showMaster = true,
  showStatus = true,
  isPlanned = false,
  isNext = false,
  onOpen,
  onEdit,
  onDelete,
  onMessage,
  onConfirm,
  onCancel,
  className = "",
  enableSwipe = true,
  openMenuId,
  setOpenMenuId,
}) {
  const { isMobile } = useBreakpoint();
  const useCompactMenu = Boolean(setOpenMenuId && onEdit && onDelete) && isMobile;
  const debt = getVisitDebt(visit);
  const amount = formatMoney(getVisitTransactionTotal(visit));
  const statusKey = visit.status || (isPlanned ? "scheduled" : "");
  const status = statusKey ? (statusLabels[statusKey] || statusLabels.scheduled) : null;
  const canConfirm = onConfirm && visit.status !== "confirmed" && visit.status !== "cancelled";
  const canCancel = onCancel && !["cancelled", "no_show", "completed"].includes(visit.status);

  const hasSwipeActions =
    !useCompactMenu &&
    enableSwipe &&
    isMobile &&
    (clientPhone || onMessage || onConfirm || onCancel || onEdit || onDelete);

  const { close, offset, swipeHandlers } = useSwipeReveal({
    enabled: hasSwipeActions,
  });

  const handleOpen = () => {
    close();
    (onOpen ?? onEdit)?.(visit);
  };

  const cardBody = useCompactMenu ? (
    <>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <strong className="text-zinc-200 text-sm font-semibold truncate">{visit.client}</strong>
        <small className="text-zinc-500 text-xs">{[visit.date, visit.time].filter(Boolean).join(" · ")}</small>
      </div>
      <RowActionsMenu
        className="ml-2 flex-none"
        itemId={visit.id}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        onDelete={() => onDelete(visit)}
        onEdit={() => onEdit(visit)}
      />
      <div className="flex justify-between items-center w-full mt-2 pt-2 border-t border-zinc-800/40">
        <span className="text-zinc-300 text-xs truncate flex-1 pr-3">{visit.service}</span>
        <b className="text-zinc-200 text-xs font-bold whitespace-nowrap">{amount}</b>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {showMaster && visit.master ? (
          <span className="px-2 py-0.5 rounded-md text-3xs font-medium text-zinc-400 bg-zinc-800/60 border border-zinc-800">
            {visit.master}
          </span>
        ) : null}
        <span className={`px-2 py-0.5 border rounded-md text-3xs font-medium ${getPaymentBadgeStyles(visit.payment, debt)}`}>
          {debt > 0 ? `Долг ${formatMoney(debt)}` : visit.payment || "Не указано"}
        </span>
        {showStatus && status ? (
          <span className={`px-2 py-0.5 border rounded-md text-3xs font-medium ${getStatusBadgeStyles(statusKey)}`}>
            {status}
          </span>
        ) : null}
      </div>
    </>
  ) : (
    <>
      <div className="flex justify-between items-start w-full gap-4">
        <div className="flex flex-col min-w-0">
          <strong className="text-indigo-400 text-xs font-semibold">{visit.time || visit.date}</strong>
          <span className="text-zinc-200 text-sm font-bold truncate mt-0.5">{visit.client}</span>
        </div>
        <b className="text-zinc-200 text-sm font-bold whitespace-nowrap">{amount}</b>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2 items-center">
        <span className="text-zinc-400 text-xs truncate max-w-[150px]">{visit.service}</span>
        {showMaster && visit.master ? (
          <span className="text-zinc-500 text-xs">· {visit.master}</span>
        ) : null}
        {showStatus && status ? (
          <span className={`px-2 py-0.5 border rounded-md text-3xs font-medium ${getStatusBadgeStyles(statusKey)}`}>
            {status}
          </span>
        ) : null}
        <span className={`px-2 py-0.5 border rounded-md text-3xs font-medium ${getPaymentBadgeStyles(visit.payment, debt)}`}>
          {debt > 0 ? `Долг ${formatMoney(debt)}` : visit.payment || "Не указано"}
        </span>
      </div>
    </>
  );

  if (hasSwipeActions) {
    return (
      <div className={`relative overflow-hidden w-full rounded-xl bg-zinc-950/30 ${className}`}>
        <div aria-hidden="true" className="absolute inset-0 flex items-center justify-end px-4 gap-2 bg-zinc-900/40">
          {clientPhone ? (
            <a
              aria-label="Позвонить"
              className="grid w-9 h-9 place-items-center rounded-lg text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-colors"
              href={`tel:${clientPhone}`}
              onClick={(event) => event.stopPropagation()}
            >
              <Phone size={18} />
            </a>
          ) : null}
          {onMessage ? (
            <button
              aria-label="Написать"
              className="grid w-9 h-9 place-items-center rounded-lg text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-colors cursor-pointer"
              type="button"
              onClick={() => onMessage(visit)}
            >
              <MessageSquareText size={18} />
            </button>
          ) : null}
          {canConfirm ? (
            <button
              aria-label="Подтвердить"
              className="grid w-9 h-9 place-items-center rounded-lg text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-550 hover:text-white transition-colors cursor-pointer"
              type="button"
              onClick={() => onConfirm(visit)}
            >
              <Check size={18} />
            </button>
          ) : null}
          {canCancel ? (
            <button
              aria-label="Отменить"
              className="grid w-9 h-9 place-items-center rounded-lg text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-550 hover:text-white transition-colors cursor-pointer"
              type="button"
              onClick={() => onCancel(visit)}
            >
              <Ban size={18} />
            </button>
          ) : null}
          {onEdit ? (
            <button
              aria-label="Изменить"
              className="grid w-9 h-9 place-items-center rounded-lg text-zinc-300 bg-zinc-855 hover:bg-zinc-800 transition-colors cursor-pointer"
              type="button"
              onClick={() => onEdit(visit)}
            >
              <Pencil size={18} />
            </button>
          ) : null}
          {onDelete ? (
            <button
              aria-label="Удалить"
              className="grid w-9 h-9 place-items-center rounded-lg text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
              type="button"
              onClick={() => onDelete(visit)}
            >
              <Trash2 size={18} />
            </button>
          ) : null}
        </div>
        <article
          className={`relative p-4 border rounded-xl transition-transform ${
            isNext
              ? "border-indigo-500/30 bg-linear-to-br from-indigo-950/20 to-zinc-900/90 shadow-md"
              : isPlanned
              ? "border-zinc-800 bg-zinc-900/60"
              : "border-zinc-850 bg-zinc-900/30"
          }`}
          style={{ transform: `translate3d(${offset}px, 0, 0)` }}
          onClick={handleOpen}
          {...swipeHandlers}
        >
          {cardBody}
        </article>
      </div>
    );
  }

  return (
    <article
      className={`p-4 border rounded-xl transition-all cursor-pointer ${
        useCompactMenu ? "flex flex-col" : "flex flex-col gap-1"
      } ${
        isNext
          ? "border-indigo-500/30 bg-linear-to-br from-indigo-950/20 to-zinc-900/90 shadow-md"
          : isPlanned
          ? "border-zinc-800 bg-zinc-900/60 shadow-sm"
          : "border-zinc-850 bg-zinc-900/30"
      } ${className}`.trim()}
      onClick={handleOpen}
    >
      {cardBody}
      {!useCompactMenu && (onMessage || onConfirm || onCancel || onEdit || onDelete || clientPhone) ? (
        <div
          className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800/40 w-full justify-end"
          onClick={(event) => event.stopPropagation()}
        >
          {clientPhone ? (
            <a
              aria-label="Позвонить"
              className="grid w-8 h-8 place-items-center border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              href={`tel:${clientPhone}`}
              onClick={(event) => event.stopPropagation()}
            >
              <Phone size={14} />
            </a>
          ) : null}
          {onMessage ? (
            <button
              aria-label="Написать"
              className="grid w-8 h-8 place-items-center border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 cursor-pointer"
              type="button"
              onClick={() => onMessage(visit)}
            >
              <MessageSquareText size={14} />
            </button>
          ) : null}
          {canConfirm ? (
            <button
              aria-label="Подтвердить"
              className="grid w-8 h-8 place-items-center border border-zinc-800 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 cursor-pointer"
              type="button"
              onClick={() => onConfirm(visit)}
            >
              <Check size={14} />
            </button>
          ) : null}
          {canCancel ? (
            <button
              aria-label="Отменить"
              className="grid w-8 h-8 place-items-center border border-zinc-800 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 cursor-pointer"
              type="button"
              onClick={() => onCancel(visit)}
            >
              <Ban size={14} />
            </button>
          ) : null}
          {onEdit ? (
            <button
              className="inline-flex items-center gap-1 min-h-[32px] px-3.5 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 hover:text-zinc-150 hover:bg-zinc-800 transition-colors cursor-pointer"
              type="button"
              onClick={() => onEdit(visit)}
            >
              <Pencil size={12} />
              Изменить
            </button>
          ) : null}
          {onDelete ? (
            <button
              className="inline-flex items-center gap-1 min-h-[32px] px-3.5 border border-red-500/20 rounded-lg text-xs font-semibold text-red-400 hover:text-white hover:bg-red-550 transition-colors cursor-pointer"
              type="button"
              onClick={() => onDelete(visit)}
            >
              <Trash2 size={12} />
              Удалить
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default VisitMobileCard;
