import { formatMoney } from "../utils/formatters.jsx";
import { getVisitDebt, getVisitTransactionTotal } from "../utils/visits.jsx";
import { useBreakpoint } from "../hooks/useBreakpoint.js";
import { useSwipeReveal } from "../hooks/useSwipeReveal.js";
import { RowActionsMenu } from "./RowActionMenuPortal.jsx";
import {AppIcon, Badge, Button, IconButton} from "./ui/index.js";

const statusLabels = {
  scheduled: "Запланирован",
  confirmed: "Подтверждён",
  completed: "Окончен",
  no_show: "Не пришёл",
  cancelled: "Отменён",
};

const getPaymentBadgeTone = (payment, debt) => {
  if (debt > 0) {
    return "is-debt";
  }
  const norm = String(payment || "").toLowerCase();
  if (norm.includes("наличные") && norm.includes("карт")) {
    return "is-card";
  }
  if (norm.includes("пакет")) {
    return "is-package";
  }
  if (norm.includes("сертификат")) {
    return "is-certificate";
  }
  if (norm.includes("карт") || norm.includes("blik") || norm.includes("mono")) {
    return "is-card";
  }
  if (norm.includes("налич")) {
    return "is-cash";
  }
  if (norm.includes("крипт")) {
    return "is-crypto";
  }
  if (norm.includes("бартер")) {
    return "is-barter";
  }
  return "is-default";
};

const getStatusBadgeTone = (status) => {
  if (["cancelled", "no_show"].includes(status)) {
    return "is-danger";
  }
  if (status === "completed") {
    return "is-success";
  }
  return "is-info";
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
  const paymentTone = getPaymentBadgeTone(visit.payment, debt);
  const statusTone = getStatusBadgeTone(statusKey);
  const canConfirm = onConfirm && visit.status !== "confirmed" && visit.status !== "cancelled";
  const canCancel = onCancel && !["cancelled", "no_show", "completed"].includes(visit.status);
  const isMixedPayment = visit.payment === "Наличные + карта";
  const paymentLabel = isMixedPayment
    ? "Наличные + карта"
    : debt > 0
      ? `Долг ${formatMoney(debt)}`
      : visit.payment || "Не указано";
  const paymentDetail = isMixedPayment
    ? `Наличные ${formatMoney(visit.cashAmount ?? 0)} · Карта ${formatMoney(visit.cardAmount ?? 0)}`
    : "";

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
      <div className="visit-mobile-card-head">
        <div className="visit-mobile-card-client">
          <div className="visit-mobile-card-name-row">
            <strong>{visit.client}</strong>
            {isVip && (
              <Badge className="client-vip-badge gap-1 shrink-0" size="sm" variant="premium">
                <AppIcon name="crown" size="xs" />
                VIP
              </Badge>
            )}
          </div>
          <small>{[visit.date, visit.time].filter(Boolean).join(" · ")}</small>
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
      <div className="visit-mobile-card-service-row">
        <span>{visit.service}</span>
        <b>{amount}</b>
      </div>
      <div className="visit-mobile-badges">
        {showMaster && visit.master ? (
          <span className="visit-mobile-badge is-master">
            {visit.master}
          </span>
        ) : null}
        <span className={`visit-mobile-badge ${paymentTone}`}>
          {paymentLabel}
        </span>
        {paymentDetail ? (
          <span className="visit-mobile-badge is-default">
            {paymentDetail}
          </span>
        ) : null}
        {showStatus && status ? (
          <span className={`visit-mobile-badge ${statusTone}`}>
            {status}
          </span>
        ) : null}
      </div>
    </>
  ) : (
    <>
      <div className="visit-mobile-card-head">
        <div className="visit-mobile-card-client">
          <strong className="visit-mobile-card-time">{visit.time || visit.date}</strong>
          <div className="visit-mobile-card-name-row">
            <span>{visit.client}</span>
            {isVip && (
              <Badge className="client-vip-badge gap-1 shrink-0" size="sm" variant="premium">
                <AppIcon name="crown" size="xs" />
                VIP
              </Badge>
            )}
          </div>
        </div>
        <b className="visit-mobile-card-amount">{amount}</b>
      </div>
      <div className="visit-mobile-card-meta-row">
        <span>{visit.service}</span>
        {showMaster && visit.master ? (
          <span>{visit.master}</span>
        ) : null}
        {showStatus && status ? (
          <span className={`visit-mobile-badge ${statusTone}`}>
            {status}
          </span>
        ) : null}
        <span className={`visit-mobile-badge ${paymentTone}`}>
          {paymentLabel}
        </span>
        {paymentDetail ? (
          <span className="visit-mobile-badge is-default">
            {paymentDetail}
          </span>
        ) : null}
      </div>
    </>
  );

  if (hasSwipeActions) {
    return (
      <div className={`visit-mobile-swipe-shell ${className}`}>
        <div className="visit-mobile-swipe-actions">
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
          className={`visit-mobile-card ${isNext ? "is-next" : ""} ${isPlanned ? "is-planned" : ""}`}
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
      className={`visit-mobile-card ${useCompactMenu ? "is-compact" : ""} ${
        isNext ? "is-next" : ""
      } ${isPlanned ? "is-planned" : ""} ${className}`.trim()}
      onClick={handleOpen}
    >
      {cardBody}
      {!useCompactMenu && (onMessage || onConfirm || onCancel || onEdit || onDelete || clientPhone) ? (
        <div
          className="visit-mobile-inline-actions"
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
