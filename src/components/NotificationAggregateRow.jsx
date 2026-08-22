import {motion} from "framer-motion";
import {useState} from "react";
import NotificationAlertRow from "./NotificationAlertRow.jsx";
import {AppIcon, Button} from "./ui/index.js";

const SWIPE_DISMISS_OFFSET = 82;
const SWIPE_DISMISS_VELOCITY = 520;

const AGGREGATE_BADGE_LABELS = {
  inactive: "Клиенты",
  packages: "Пакеты",
  supplies: "Склад",
  tasks: "Дела",
};

const AGGREGATE_STATUS_LABELS = {
  packages: "Низкий остаток",
  supplies: "Ниже минимума",
  tasks: "Требуют внимания",
};

const getAggregateTitle = (alert) => {
  if (alert.aggregateKind === "inactive") return "Клиенты";
  if (alert.aggregateKind === "packages") return "Пакеты";
  if (alert.aggregateKind === "supplies") return "Склад";
  if (alert.aggregateKind === "tasks") return "Задачи";
  return alert.title;
};

export default function NotificationAggregateRow({
  alert,
  onAction,
  onSnoozeReview,
  onSnoozeToday,
}) {
  const [expanded, setExpanded] = useState(false);
  const [dismissDirection, setDismissDirection] = useState(0);
  const displayTitle = getAggregateTitle(alert);
  const snoozeBySwipe = () => (onSnoozeReview ?? onSnoozeToday)(alert);

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
      className="client-alert-aggregate"
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
      <div
        className={`client-alert-row client-alert-row-unified priority-${alert.priority}`}
      >
        <div className="client-alert-row-main">
          <Button
            className="client-alert-aggregate-toggle"
            type="button"
            variant="ghost"
            onClick={() => setExpanded((current) => !current)}>
            <AppIcon className={expanded ? "open" : ""} name="chevronDown" size="xs" />
            <div className="client-alert-row-copy">
              <div className="client-alert-meta-badges">
                <span
                  className={`client-alert-meta-badge is-${alert.aggregateKind ?? alert.group}`}>
                  {AGGREGATE_BADGE_LABELS[alert.aggregateKind] ?? "Группа"}
                </span>
                {AGGREGATE_STATUS_LABELS[alert.aggregateKind] ? (
                  <span
                    className={`client-alert-meta-badge is-${alert.aggregateKind}-status`}>
                    {AGGREGATE_STATUS_LABELS[alert.aggregateKind]}
                  </span>
                ) : null}
                <span className="client-alert-meta-badge is-count">
                  {alert.children.length}
                </span>
              </div>
              <strong>{displayTitle}</strong>
              <span>{alert.message}</span>
            </div>
          </Button>
        </div>
        <div className="client-alert-actions">
          <Button
            className="client-alert-action-button is-open"
            size="sm"
            type="button"
            variant="subtle"
            onClick={(event) => {
              event.stopPropagation();
              onAction(alert, "open");
            }}
            onPointerDown={(event) => event.stopPropagation()}>
            Открыть группу
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="client-alert-aggregate-children">
          {alert.children.map((childAlert) => (
            <NotificationAlertRow
              alert={childAlert}
              key={childAlert.id}
              onAction={onAction}
              onSnoozeReview={onSnoozeReview}
              onSnoozeToday={onSnoozeToday}
            />
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}
