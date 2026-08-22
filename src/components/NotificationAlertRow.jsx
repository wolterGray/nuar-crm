import {motion} from "framer-motion";
import {useState} from "react";
import {Button} from "./ui/index.js";

const SWIPE_DISMISS_OFFSET = 82;
const SWIPE_DISMISS_VELOCITY = 520;

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
  forecast: "Прогноз",
  inactive: "Клиент",
  package: "Пакет",
  supply: "Склад",
  task: "Дело",
  undo: "Возврат",
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

export default function NotificationAlertRow({
  alert,
  onAction,
  onSnoozeReview,
  onSnoozeToday,
}) {
  const [dismissDirection, setDismissDirection] = useState(0);
  const primaryActions = alert.actions.filter(
    (action) => action !== "snooze" && action !== "dismiss",
  );
  const metaBadges = getAlertMetaBadges(alert);
  const cornerBadge = getCornerBadge(alert);
  const displayTitle = getAlertDisplayTitle(alert);
  const displayMessage = getAlertDisplayMessage(alert, displayTitle);
  const snoozeBySwipe = () => {
    if (alert.actions.includes("snooze")) {
      (onSnoozeReview ?? onSnoozeToday)(alert);
      return;
    }

    if (alert.actions.includes("dismiss")) {
      onAction(alert, "dismiss");
    }
  };

  return (
    <motion.div
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
      className={`client-alert-row client-alert-row-unified has-corner-badge priority-${alert.priority} type-${alert.type}`}
      drag="x"
      dragConstraints={{left: 0, right: 0}}
      dragElastic={0.26}
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
      whileTap={{scale: 0.995}}
      onDragEnd={(_, info) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;
        const direction = offset < 0 || velocity < 0 ? -1 : 1;

        if (
          Math.abs(offset) > SWIPE_DISMISS_OFFSET ||
          Math.abs(velocity) > SWIPE_DISMISS_VELOCITY
        ) {
          setDismissDirection(direction);
          snoozeBySwipe();
          return;
        }

        setDismissDirection(0);
      }}>
      {cornerBadge ? (
        <span className={`client-alert-corner-badge ${cornerBadge.className}`}>
          {cornerBadge.label}
        </span>
      ) : null}
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
          <strong>{displayTitle}</strong>
          <span>{displayMessage}</span>
        </div>
      </div>
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
    </motion.div>
  );
}
