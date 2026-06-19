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
import {RowActionsMenu} from "./RowActionMenuPortal.jsx";

const statusLabels = {
  scheduled: "Запланирован",
  confirmed: "Подтверждён",
  completed: "Окончен",
  no_show: "Не пришёл",
  cancelled: "Отменён",
};

const badgeStyles = {
  statusScheduled: {color: "#9fc4ff", background: "rgba(77, 141, 255, 0.13)"},
  statusCompleted: {color: "#9fd8b8", background: "rgba(34, 197, 94, 0.12)"},
  statusDanger: {color: "#f3a1a1", background: "rgba(239, 68, 68, 0.12)"},
  cash: {color: "#9fd8b8", background: "rgba(34, 197, 94, 0.11)"},
  card: {color: "#9fc4ff", background: "rgba(77, 141, 255, 0.12)"},
  package: {color: "#d6c2ff", background: "rgba(167, 139, 250, 0.12)"},
  certificate: {color: "#f0d48f", background: "rgba(251, 191, 36, 0.12)"},
  crypto: {color: "#91d5e8", background: "rgba(20, 184, 166, 0.12)"},
  barter: {color: "#e5b7a2", background: "rgba(251, 146, 60, 0.12)"},
  debt: {color: "#f3a1a1", background: "rgba(239, 68, 68, 0.12)"},
  unknown: {color: "#f0d48f", background: "rgba(251, 191, 36, 0.12)"},
};

const toBadgeStyle = ({color, background}) => ({
  "--visit-badge-bg": background,
  "--visit-badge-color": color,
});

const getPaymentBadge = (payment) => {
  const normalizedPayment = String(payment || "Не указано").toLowerCase();

  if (normalizedPayment.includes("пакет")) return ["visit-mobile-card-payment-package", badgeStyles.package];
  if (normalizedPayment.includes("сертификат")) return ["visit-mobile-card-payment-certificate", badgeStyles.certificate];
  if (normalizedPayment.includes("карт") || normalizedPayment.includes("blik") || normalizedPayment.includes("mono")) {
    return ["visit-mobile-card-payment-card", badgeStyles.card];
  }
  if (normalizedPayment.includes("налич")) return ["visit-mobile-card-payment-cash", badgeStyles.cash];
  if (normalizedPayment.includes("крипт")) return ["visit-mobile-card-payment-crypto", badgeStyles.crypto];
  if (normalizedPayment.includes("бартер")) return ["visit-mobile-card-payment-barter", badgeStyles.barter];

  return ["visit-mobile-card-payment-unknown", badgeStyles.unknown];
};

const getStatusBadgeStyle = (status) => {
  if (["cancelled", "no_show"].includes(status)) return badgeStyles.statusDanger;
  if (status === "completed") return badgeStyles.statusCompleted;

  return badgeStyles.statusScheduled;
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
  const {isMobile} = useBreakpoint();
  const useCompactMenu =
    Boolean(setOpenMenuId && onEdit && onDelete) && isMobile;
  const debt = getVisitDebt(visit);
  const amount = formatMoney(getVisitTransactionTotal(visit));
  const statusKey = visit.status || (isPlanned ? "scheduled" : "");
  const status = statusKey ? (statusLabels[statusKey] || statusLabels.scheduled) : null;
  const [paymentBadgeClass, paymentBadgeStyle] = getPaymentBadge(visit.payment);
  const paymentStyle = toBadgeStyle(debt > 0 ? badgeStyles.debt : paymentBadgeStyle);
  const statusStyle = status ? toBadgeStyle(getStatusBadgeStyle(statusKey)) : undefined;
  const canConfirm =
    onConfirm && visit.status !== "confirmed" && visit.status !== "cancelled";
  const canCancel =
    onCancel && !["cancelled", "no_show", "completed"].includes(visit.status);
  const hasSwipeActions =
    !useCompactMenu &&
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

  const cardBody = useCompactMenu ? (
    <>
      <div className="visit-mobile-card-head">
        <strong>{visit.client}</strong>
        <small>{[visit.date, visit.time].filter(Boolean).join(" · ")}</small>
      </div>
      <RowActionsMenu
        className="visit-row-actions"
        itemId={visit.id}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        onDelete={() => onDelete(visit)}
        onEdit={() => onEdit(visit)}
      />
      <div className="visit-mobile-card-line">
        <span>{visit.service}</span>
        <b className="visit-mobile-card-amount">{amount}</b>
      </div>
      <div className="visit-mobile-card-meta">
        {showMaster && visit.master ? <span>{visit.master}</span> : null}
        <span
          className={debt > 0 ? "visit-mobile-card-payment visit-mobile-card-debt" : `visit-mobile-card-payment ${paymentBadgeClass}`}
          style={paymentStyle}>
          {debt > 0 ? `Долг ${formatMoney(debt)}` : visit.payment || "Не указано"}
        </span>
        {showStatus && status ? (
          <span
            className={`visit-mobile-card-status visit-mobile-card-status-${statusKey || "scheduled"}`}
            style={statusStyle}>
            {status}
          </span>
        ) : null}
      </div>
    </>
  ) : (
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
          <span
            className={`visit-mobile-card-status visit-mobile-card-status-${statusKey || "scheduled"}`}
            style={statusStyle}>
            {status}
          </span>
        ) : null}
        <span
          className={debt > 0 ? "visit-mobile-card-payment visit-mobile-card-debt" : `visit-mobile-card-payment ${paymentBadgeClass}`}
          style={paymentStyle}>
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
      className={`visit-mobile-card ${useCompactMenu ? "visit-mobile-card-compact" : ""} ${isPlanned ? "visit-mobile-card-planned" : ""} ${isNext ? "visit-mobile-card-next" : ""} ${className}`.trim()}
      onClick={handleOpen}>
      {cardBody}
      {!useCompactMenu &&
      (onMessage || onConfirm || onCancel || onEdit || onDelete || clientPhone) ? (
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
      ) : null}
    </article>
  );
}

export default VisitMobileCard;
