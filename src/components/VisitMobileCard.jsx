import { formatMoney } from "../utils/formatters.jsx";
import { getVisitDebt, getVisitTransactionTotal } from "../utils/visits.jsx";
import { useBreakpoint } from "../hooks/useBreakpoint.js";
import { useSwipeReveal } from "../hooks/useSwipeReveal.js";
import { RowActionsMenu } from "./RowActionMenuPortal.jsx";
import {AppIcon, Button, IconButton} from "./ui/index.js";

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
  clientProfiles = [],
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

  const clientProfile = clientProfiles.find(
    (c) =>
      c.id === visit.clientId ||
      (visit.client && c.name?.toLowerCase() === visit.client.toLowerCase())
  );
  const isVip = clientProfile && (clientProfile.visitsCount >= 10 || (clientProfile.totalIncome || 0) >= 2000);

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
      <div className="flex items-start justify-between w-full gap-2">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <strong className="text-zinc-200 text-sm font-semibold truncate">{visit.client}</strong>
            {isVip && (
              <span className="client-vip-badge inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                👑 VIP
              </span>
            )}
          </div>
          <small className="text-zinc-500 text-xs">{[visit.date, visit.time].filter(Boolean).join(" · ")}</small>
        </div>
        <RowActionsMenu
          className="ml-2 flex-none visit-row-actions"
          itemId={visit.id}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onDelete={() => onDelete(visit)}
          onEdit={() => onEdit(visit)}
        />
      </div>
      <div className="flex justify-between items-baseline w-full mt-2.5">
        <span className="text-zinc-300 text-xs truncate flex-1 pr-3">{visit.service}</span>
        <b className="text-zinc-200 text-xs font-semibold whitespace-nowrap">{amount}</b>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {showMaster && visit.master ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium text-zinc-400 bg-zinc-800/60 border border-zinc-800">
            {visit.master}
          </span>
        ) : null}
        <span className={`px-2 py-0.5 border rounded-md text-[10px] font-medium ${getPaymentBadgeStyles(visit.payment, debt)}`}>
          {debt > 0 ? `Долг ${formatMoney(debt)}` : visit.payment || "Не указано"}
        </span>
        {showStatus && status ? (
          <span className={`px-2 py-0.5 border rounded-md text-[10px] font-medium ${getStatusBadgeStyles(statusKey)}`}>
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
          <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
            <span className="text-zinc-200 text-sm font-bold truncate">{visit.client}</span>
            {isVip && (
              <span className="client-vip-badge inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                👑 VIP
              </span>
            )}
          </div>
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
        <div className="absolute inset-0 flex items-center justify-end px-4 gap-2 bg-zinc-900/40">
          {clientPhone ? (
            <a
              aria-label="Позвонить"
              className="visit-mobile-swipe-link"
              href={`tel:${clientPhone}`}
              onClick={(event) => event.stopPropagation()}
            >
              <AppIcon name="phone" size="md" />
            </a>
          ) : null}
          {onMessage ? (
            <IconButton
              icon="message"
              label="Написать"
              size="md"
              type="button"
              variant="subtle"
              onClick={() => onMessage(visit)}
            />
          ) : null}
          {canConfirm ? (
            <IconButton
              icon="check"
              label="Подтвердить"
              size="md"
              type="button"
              variant="success"
              onClick={() => onConfirm(visit)}
            />
          ) : null}
          {canCancel ? (
            <IconButton
              icon="ban"
              label="Отменить"
              size="md"
              type="button"
              variant="danger"
              onClick={() => onCancel(visit)}
            />
          ) : null}
          {onEdit ? (
            <IconButton
              icon="edit"
              label="Изменить"
              size="md"
              type="button"
              variant="subtle"
              onClick={() => onEdit(visit)}
            />
          ) : null}
          {onDelete ? (
            <IconButton
              icon="trash"
              label="Удалить"
              size="md"
              type="button"
              variant="danger"
              onClick={() => onDelete(visit)}
            />
          ) : null}
        </div>
        <article
          className={`visit-mobile-card relative p-4 border rounded-xl transition-transform ${
            isNext
              ? "border-indigo-500/30 bg-linear-to-br from-indigo-950/20 to-surfaceAlt shadow-md"
              : isPlanned
              ? "border-border/40 bg-surfaceAlt shadow-sm"
              : "border-border/20 bg-surfaceAlt/70"
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
      className={`visit-mobile-card p-4 border rounded-xl transition-all cursor-pointer ${
        useCompactMenu ? "flex flex-col" : "flex flex-col gap-1"
      } ${
        isNext
          ? "border-indigo-500/30 bg-linear-to-br from-indigo-950/20 to-surfaceAlt shadow-md"
          : isPlanned
          ? "border-border/40 bg-surfaceAlt shadow-sm"
          : "border-border/20 bg-surfaceAlt/70"
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
              className="visit-mobile-inline-link"
              href={`tel:${clientPhone}`}
              onClick={(event) => event.stopPropagation()}
            >
              <AppIcon name="phone" size="sm" />
            </a>
          ) : null}
          {onMessage ? (
            <IconButton
              icon="message"
              label="Написать"
              size="sm"
              type="button"
              variant="subtle"
              onClick={() => onMessage(visit)}
            />
          ) : null}
          {canConfirm ? (
            <IconButton
              icon="check"
              label="Подтвердить"
              size="sm"
              type="button"
              variant="success"
              onClick={() => onConfirm(visit)}
            />
          ) : null}
          {canCancel ? (
            <IconButton
              icon="ban"
              label="Отменить"
              size="sm"
              type="button"
              variant="danger"
              onClick={() => onCancel(visit)}
            />
          ) : null}
          {onEdit ? (
            <Button
              leftIcon="edit"
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => onEdit(visit)}
            >
              Изменить
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              leftIcon="trash"
              size="sm"
              type="button"
              variant="danger"
              onClick={() => onDelete(visit)}
            >
              Удалить
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default VisitMobileCard;
