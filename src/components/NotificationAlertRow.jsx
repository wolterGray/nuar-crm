import {animate, motion, useMotionValue} from "framer-motion";
import {useState} from "react";
import {useSwipeable} from "react-swipeable";
import {AppIcon, Button, IconButton} from "./ui/index.js";

const CRM_TIME_ZONE = "Europe/Warsaw";

const SWIPE_CONFIRM_DELTA = 76;
const SWIPE_HINT_LIMIT = 92;
const SWIPE_REVEAL_OFFSET = 86;

const ACTION_LABELS = {
  calendar: "Календарь",
  client: "Открыть",
  complete: "Готово",
  dismiss: "Убрать",
  open: "Открыть",
  order: "Заказать",
  sell: "Продать",
  snooze: "Скрыть",
  stock: "+1",
  undo: "Вернуть",
  write: "Написать",
};

const ACTION_ICONS = {
  calendar: "calendar",
  client: "user",
  complete: "check",
  order: "external",
  sell: "package",
  stock: "package",
  write: "message",
};

const TYPE_BADGE_LABELS = {
  birthday: "День рождения",
  calendar: "Визит сегодня",
  certificate: "Сертификат",
  financial_quality: "Деньги",
  forecast: "Прогноз",
  inactive: "Клиент",
  package: "Пакет",
  supply: "Склад",
  task: "Дело",
  undo: "Возврат",
  unclosed_visit: "Закрыть визит",
  visit: "Визит",
};

const getAlertDisplayTitle = (alert) => {
  if (alert.type === "calendar" && alert.meta?.entry?.client) {
    return alert.meta.entry.client;
  }

  if (alert.type === "inactive") {
    const clientName =
      alert.meta?.client?.name ||
      String(alert.message ?? "").split("·")[0]?.trim();

    if (clientName) {
      return clientName;
    }
  }

  return alert.title;
};

const getAlertDisplayMessage = (alert, displayTitle) => {
  if (alert.type === "inactive") {
    const message = String(alert.message ?? "").trim();
    const prefix = `${displayTitle} ·`;

    if (message.startsWith(prefix)) {
      return message.slice(prefix.length).trim();
    }
  }

  return alert.message;
};

const getAlertMetaBadges = (alert) => {
  const badges = [];

  if (alert.type === "calendar" && alert.meta?.entry?.time) {
    badges.push({
      className: "is-time",
      id: "time",
      label: alert.meta.entry.time,
    });
  }

  return badges;
};

const getCornerBadge = (alert) => {
  if (alert.type === "inactive") {
    return {
      className: "is-inactive-stale",
      label: alert.meta?.client?.daysAbsent
        ? `${alert.meta.client.daysAbsent} дн. без визита`
        : "Давно не было",
    };
  }

  return {
    className: `is-${alert.type}`,
    label: TYPE_BADGE_LABELS[alert.type] ?? "Уведомление",
  };
};

const getActionLabel = (alert, action) => {
  if (action === "write") return "Написать SMS";

  if (action === "client") return "Карточка клиента";

  if (
    action === "open" &&
    (alert.page === "clients" ||
      ["birthday", "inactive", "package"].includes(alert.type))
  ) {
    return "Карточка клиента";
  }

  return ACTION_LABELS[action];
};

const getActionIcon = (action) => {
  if (["client", "open", "write"].includes(action)) return null;
  return ACTION_ICONS[action];
};

const formatAlertTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: CRM_TIME_ZONE,
  }).format(date);
};

const formatBusinessDate = (value, time = "") => {
  if (!value) return "";
  const normalized = /^\d{2}\.\d{2}\.\d{4}$/.test(String(value))
    ? String(value).split(".").reverse().join("-")
    : String(value);
  const date = new Date(`${normalized}${time ? `T${time}` : "T12:00:00"}`);
  if (Number.isNaN(date.getTime())) return [value, time].filter(Boolean).join(", ");
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: CRM_TIME_ZONE,
  }).format(date).replace(".", "");
  return time ? `${formatted}, ${time}` : formatted;
};

const getHistoryContext = (alert) => {
  const event = alert.meta?.serverEvent;
  const payload = event?.payload ?? alert.meta?.item ?? {};
  if (!event) return alert.message;
  const service = payload.serviceName ?? payload.service ?? event.clientName;
  const master = payload.employeeName ?? payload.master;
  const context = [service, master].filter(Boolean).join(" · ");
  const oldDate = payload.oldDate ?? payload.previousDate ?? payload.fromDate;
  const oldTime = payload.oldTime ?? payload.previousTime ?? payload.fromTime;
  const newDate = payload.newDate ?? payload.date ?? payload.toDate;
  const newTime = payload.newTime ?? payload.time ?? payload.toTime;
  const schedule = event.type === "visit_rescheduled" && oldDate
    ? `${formatBusinessDate(oldDate, oldTime)} → ${formatBusinessDate(newDate, newTime)}`
    : formatBusinessDate(newDate, newTime);
  return [context || alert.message, schedule].filter(Boolean).join("\n");
};

export default function NotificationAlertRow({
  alert,
  historyMode = false,
  onAction,
  onDismissPermanent,
  onSwipeAction,
  onSnoozeReview,
  onSnoozeToday,
}) {
  const [armedDirection, setArmedDirection] = useState(0);
  const [dismissDirection, setDismissDirection] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const [swipeHint, setSwipeHint] = useState(null);
  const swipeX = useMotionValue(0);
  const cardAction = historyMode
    ? ["open", "calendar", "client"].find((action) => alert.actions.includes(action)) ?? null
    : alert.type === "calendar" && alert.actions.includes("calendar")
      ? "calendar"
      : null;
  const primaryActions = alert.actions.filter(
    (action) =>
      action !== "snooze" && action !== "dismiss" && action !== cardAction,
  ).slice(0, 2);
  const metaBadges = getAlertMetaBadges(alert);
  const cornerBadge = getCornerBadge(alert);
  const displayTitle = getAlertDisplayTitle(alert);
  const displayMessage = historyMode
    ? getHistoryContext(alert)
    : getAlertDisplayMessage(alert, displayTitle);
  const category = alert.category ?? alert.meta?.category ??
    (["critical", "action"].includes(alert.priority) ? "action" : "information");
  const canDismiss = category === "information" || category === "opportunity" || alert.type === "undo";
  const timestamp = formatAlertTime(alert.createdAt ?? alert.meta?.notification?.archivedAt);
  const snoozeBySwipe = () => {
    if (alert.actions.includes("snooze")) {
      (onSnoozeReview ?? onSnoozeToday)(alert);
      return;
    }

    if (alert.actions.includes("dismiss")) {
      onAction(alert, "dismiss");
    }
  };
  const dismissFromSwipe = (direction) => {
    setDismissDirection(direction);
    setArmedDirection(0);
    setSwipeHint(direction < 0 ? "close" : "snooze");

    if (onSwipeAction) {
      onSwipeAction(alert, direction < 0 ? "close" : "snooze");
      return;
    }

    snoozeBySwipe();
  };
  const resetSwipeReveal = () => {
    setArmedDirection(0);
    setSwipeHint(null);
    animate(swipeX, 0, {duration: 0.18, ease: "easeOut"});
  };
  const revealSwipeAction = (direction) => {
    setArmedDirection(direction);
    setSwipeHint(direction < 0 ? "close" : "snooze");
    animate(swipeX, direction * SWIPE_REVEAL_OFFSET, {
      duration: 0.18,
      ease: "easeOut",
    });
  };
  const handleCardAction = () => {
    if (!cardAction || dismissDirection) return;

    if (armedDirection) {
      resetSwipeReveal();
      return;
    }

    onAction(alert, cardAction);
  };
  const handleCardKeyDown = (event) => {
    if (!cardAction || !["Enter", " "].includes(event.key)) return;

    event.preventDefault();
    handleCardAction();
  };
  const swipeHandlers = useSwipeable({
    delta: SWIPE_CONFIRM_DELTA,
    preventScrollOnSwipe: false,
    swipeDuration: 760,
    trackMouse: false,
    trackTouch: true,
    onSwipeStart: () => {
      if (!armedDirection) {
        setSwipeHint(null);
      }
    },
    onSwiping: ({deltaX}) => {
      const nextHint = deltaX < -18 ? "close" : deltaX > 18 ? "snooze" : null;
      const fallbackHint =
        armedDirection < 0 ? "close" : armedDirection > 0 ? "snooze" : null;
      const activeHint = nextHint ?? fallbackHint;
      const baseX = armedDirection * SWIPE_REVEAL_OFFSET;
      const clampedX = Math.max(
        -SWIPE_HINT_LIMIT,
        Math.min(SWIPE_HINT_LIMIT, baseX + deltaX),
      );

      swipeX.set(clampedX);
      setSwipeHint((current) => (current === activeHint ? current : activeHint));
    },
    onSwiped: ({dir}) => {
      const direction = dir === "Left" ? -1 : dir === "Right" ? 1 : 0;

      if (!direction) {
        if (armedDirection) {
          revealSwipeAction(armedDirection);
          return;
        }

        resetSwipeReveal();
        return;
      }

      if (!armedDirection) {
        revealSwipeAction(direction);
        return;
      }

      if (armedDirection === direction) {
        dismissFromSwipe(direction);
        return;
      }

      resetSwipeReveal();
    },
    onTap: () => {
      if (armedDirection) {
        resetSwipeReveal();
      }
    },
  });

  const shellActionClass =
    swipeHint ?? (armedDirection < 0 ? "close" : armedDirection > 0 ? "snooze" : null);

  return (
    <motion.div
      {...swipeHandlers}
      animate={
        dismissDirection
          ? {
              height: 0,
              marginTop: 0,
              opacity: 0,
              paddingBottom: 0,
              paddingTop: 0,
              x: dismissDirection * 360,
            }
          : {opacity: 1, x: 0}
      }
      className={`client-alert-swipe-shell category-${category} ${shellActionClass ? `is-${shellActionClass}` : ""}`}
      exit={{
        height: 0,
        marginTop: 0,
        opacity: 0,
        paddingBottom: 0,
        paddingTop: 0,
        x: dismissDirection * 360 || 220,
      }}
      layout
      style={{overflow: "hidden"}}
      transition={{duration: dismissDirection ? 0.2 : 0.18, ease: "easeOut"}}
      whileTap={{scale: 0.995}}>
      <div className="client-alert-swipe-underlay">
        <span className="client-alert-swipe-cue is-snooze">Отложить</span>
        <span className="client-alert-swipe-cue is-close">Скрыть</span>
      </div>
      <motion.div
        className={`client-alert-row client-alert-row-unified has-corner-badge priority-${alert.priority} type-${alert.type} ${historyMode ? "is-history" : ""}`}
        role={cardAction ? "button" : undefined}
        style={{x: swipeX}}
        tabIndex={cardAction ? 0 : undefined}
        onClick={cardAction ? handleCardAction : undefined}
        onKeyDown={cardAction ? handleCardKeyDown : undefined}>
        {!historyMode && cornerBadge && alert.type !== "undo" ? (
          <span className={`client-alert-corner-badge ${cornerBadge.className}`}>
            {cornerBadge.label}
          </span>
        ) : null}
        {canDismiss ? <IconButton
          className="client-alert-dismiss-button"
          disabled={isDismissing}
          icon="x"
          label="Скрыть уведомление"
          size="sm"
          type="button"
          variant="ghost"
          onClick={async (event) => {
            event.stopPropagation();
            setIsDismissing(true);
            await onDismissPermanent?.(alert);
            setIsDismissing(false);
          }}
          onPointerDown={(event) => event.stopPropagation()}
        /> : null}
        <div className="client-alert-row-main">
          <div className="client-alert-row-copy">
            {metaBadges.length ? (
              <div className="client-alert-meta-badges">
                {metaBadges.map((badge) => (
                  <span
                    className={`client-alert-meta-badge ${badge.className}`}
                    key={badge.id}>
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="client-alert-title-line">
              <strong title={displayTitle}>{displayTitle}</strong>
              {timestamp ? <time>{timestamp}</time> : null}
            </div>
            <span>{displayMessage}</span>
          </div>
        </div>
        {historyMode && cardAction ? <AppIcon className="client-alert-history-chevron" name="chevronRight" size="sm" /> : null}
        {!historyMode && primaryActions.length ? (
          <div className="client-alert-actions">
            {primaryActions.map((action) => {
              return (
                <Button
                  className={`client-alert-action-button is-${action}`}
                  key={action}
                  leftIcon={getActionIcon(action)}
                  size="sm"
                  type="button"
                  variant="subtle"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAction(alert, action);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}>
                  {getActionLabel(alert, action)}
                </Button>
              );
            })}
          </div>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
