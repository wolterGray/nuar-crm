import {
  Ban,
  Check,
  MessageSquareText,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import {formatMoney} from "../utils/formatters.jsx";
import {getVisitDebt, getVisitTransactionTotal} from "../utils/visits.jsx";
import {useBreakpoint} from "../hooks/useBreakpoint.js";
import {useSwipeReveal} from "../hooks/useSwipeReveal.js";

const statusLabels = {
  scheduled: "Запланирован",
  confirmed: "Подтверждён",
  completed: "Окончен",
  no_show: "Не пришёл",
  cancelled: "Отменён",
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
}) {
  const {isMobile} = useBreakpoint();
  const debt = getVisitDebt(visit);
  const amount = formatMoney(getVisitTransactionTotal(visit));
  const status = visit.status ? (statusLabels[visit.status] || statusLabels.scheduled) : null;
  const canConfirm =
    onConfirm && visit.status !== "confirmed" && visit.status !== "cancelled";
  const canCancel =
    onCancel && !["cancelled", "no_show", "completed"].includes(visit.status);
  const hasSwipeActions =
    enableSwipe &&
    isMobile &&
    (clientPhone || onMessage || onConfirm || onCancel || onEdit || onDelete);
  const {close, offset, swipeHandlers} = useSwipeReveal({
    enabled: hasSwipeActions,
  });

  const handleOpen = () => {
    close();
    (onOpen ?? onEdit)?.(visit);
  };

  const cardBody = (
    <>
      <div className="visit-mobile-card-top">
        <div className="visit-mobile-card-time-block">
          <strong className="visit-mobile-card-time">{visit.time || visit.date}</strong>
          <span className="visit-mobile-card-client">{visit.client}</span>
        </div>
        <b className="visit-mobile-card-amount">{amount}</b>
      </div>
      <div className="visit-mobile-card-meta">
        <span>{visit.service}</span>
        {showMaster && visit.master ? <span>{visit.master}</span> : null}
        {showStatus && status ? (
          <span className={`visit-mobile-card-status visit-mobile-card-status-${visit.status || "scheduled"}`}>
            {status}
          </span>
        ) : null}
        <span className={debt > 0 ? "visit-mobile-card-payment visit-mobile-card-debt" : "visit-mobile-card-payment"}>
          {debt > 0 ? `Долг ${formatMoney(debt)}` : visit.payment || "Не указано"}
        </span>
      </div>
    </>
  );

  if (hasSwipeActions) {
    return (
      <div className={`visit-mobile-card-swipe ${className}`.trim()}>
        <div aria-hidden="true" className="visit-mobile-card-swipe-behind">
          {clientPhone ? (
            <a
              aria-label="Позвонить"
              className="visit-mobile-swipe-action visit-mobile-swipe-call"
              href={`tel:${clientPhone}`}
              onClick={(event) => event.stopPropagation()}>
              <Phone size={18} />
            </a>
          ) : null}
          {onMessage ? (
            <button
              aria-label="Написать"
              className="visit-mobile-swipe-action visit-mobile-swipe-message"
              type="button"
              onClick={() => onMessage(visit)}>
              <MessageSquareText size={18} />
            </button>
          ) : null}
          {canConfirm ? (
            <button
              aria-label="Подтвердить"
              className="visit-mobile-swipe-action visit-mobile-swipe-confirm"
              type="button"
              onClick={() => onConfirm(visit)}>
              <Check size={18} />
            </button>
          ) : null}
          {canCancel ? (
            <button
              aria-label="Отменить"
              className="visit-mobile-swipe-action visit-mobile-swipe-cancel"
              type="button"
              onClick={() => onCancel(visit)}>
              <Ban size={18} />
            </button>
          ) : null}
          {onEdit ? (
            <button
              aria-label="Изменить"
              className="visit-mobile-swipe-action visit-mobile-swipe-edit"
              type="button"
              onClick={() => onEdit(visit)}>
              <Pencil size={18} />
            </button>
          ) : null}
          {onDelete ? (
            <button
              aria-label="Удалить"
              className="visit-mobile-swipe-action visit-mobile-swipe-delete"
              type="button"
              onClick={() => onDelete(visit)}>
              <Trash2 size={18} />
            </button>
          ) : null}
        </div>
        <article
          className={`visit-mobile-card ${isPlanned ? "visit-mobile-card-planned" : ""} ${isNext ? "visit-mobile-card-next" : ""} visit-mobile-card-swipe-surface`}
          style={{transform: `translate3d(${offset}px, 0, 0)`}}
          onClick={handleOpen}
          {...swipeHandlers}>
          {cardBody}
        </article>
      </div>
    );
  }

  return (
    <article
      className={`visit-mobile-card ${isPlanned ? "visit-mobile-card-planned" : ""} ${isNext ? "visit-mobile-card-next" : ""} ${className}`.trim()}
      onClick={handleOpen}>
      {cardBody}
      {(onMessage || onConfirm || onCancel || onEdit || onDelete || clientPhone) && (
        <div className="visit-mobile-card-actions" onClick={(event) => event.stopPropagation()}>
          {clientPhone ? (
            <a
              aria-label="Позвонить"
              className="client-quick-action visit-mobile-action-icon"
              href={`tel:${clientPhone}`}
              onClick={(event) => event.stopPropagation()}>
              <Phone size={16} />
            </a>
          ) : null}
          {onMessage ? (
            <button
              aria-label="Написать"
              className="client-quick-action visit-mobile-action-icon"
              type="button"
              onClick={() => onMessage(visit)}>
              <MessageSquareText size={16} />
            </button>
          ) : null}
          {canConfirm ? (
            <button
              aria-label="Подтвердить"
              className="client-quick-action visit-mobile-action-icon visit-mobile-action-confirm"
              type="button"
              onClick={() => onConfirm(visit)}>
              <Check size={16} />
            </button>
          ) : null}
          {canCancel ? (
            <button
              aria-label="Отменить"
              className="client-quick-action visit-mobile-action-icon visit-mobile-action-cancel"
              type="button"
              onClick={() => onCancel(visit)}>
              <Ban size={16} />
            </button>
          ) : null}
          {onEdit ? (
            <button
              className="client-quick-action"
              type="button"
              onClick={() => onEdit(visit)}>
              <Pencil size={14} />
              Изменить
            </button>
          ) : null}
          {onDelete ? (
            <button
              className="client-quick-action visit-mobile-delete"
              type="button"
              onClick={() => onDelete(visit)}>
              <Trash2 size={14} />
              Удалить
            </button>
          ) : null}
        </div>
      )}
    </article>
  );
}

export default VisitMobileCard;
