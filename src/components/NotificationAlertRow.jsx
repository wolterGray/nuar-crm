import {
  CalendarDays,
  Check,
  ExternalLink,
  EyeOff,
  MessageSquareText,
  MoreHorizontal,
  PackagePlus,
  UserRound,
} from "lucide-react";
import {useState} from "react";

const ACTION_LABELS = {
  calendar: "Календарь",
  client: "Клиент",
  complete: "Готово",
  dismiss: "Убрать",
  open: "Открыть",
  order: "Заказать",
  snooze: "Скрыть",
  stock: "+1",
  undo: "Вернуть",
  write: "Написать",
};

const ACTION_ICONS = {
  calendar: CalendarDays,
  client: UserRound,
  complete: Check,
  order: ExternalLink,
  stock: PackagePlus,
  write: MessageSquareText,
};

export default function NotificationAlertRow({
  alert,
  onAction,
  onDismissPermanent,
  onSnoozeToday,
  onSnoozeWeek,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const primaryActions = alert.actions.filter(
    (action) => action !== "snooze" && action !== "dismiss",
  );

  return (
    <div
      className={`client-alert-row client-alert-row-unified priority-${alert.priority}`}>
      <div className="client-alert-row-main">
        <div className="client-alert-row-copy">
          <strong>{alert.title}</strong>
          <span>{alert.message}</span>
        </div>
        <span className={`client-alert-priority priority-${alert.priority}`}>
          {alert.priority === "critical"
            ? "Срочно"
            : alert.priority === "action"
              ? "Дело"
              : "Инфо"}
        </span>
      </div>
      <div className="client-alert-actions">
        {primaryActions.map((action) => {
          const Icon = ACTION_ICONS[action];

          return (
            <button
              key={action}
              type="button"
              onClick={() => onAction(alert, action)}>
              {Icon ? <Icon size={14} /> : null}
              {ACTION_LABELS[action]}
            </button>
          );
        })}
        {alert.actions.includes("snooze") ? (
          <div className="client-alert-snooze">
            <button
              aria-expanded={menuOpen}
              aria-label="Скрыть уведомление"
              type="button"
              onClick={() => setMenuOpen((current) => !current)}>
              <EyeOff size={14} />
              <MoreHorizontal size={12} />
            </button>
            {menuOpen ? (
              <div className="client-alert-snooze-menu">
                <button
                  type="button"
                  onClick={() => {
                    onSnoozeToday(alert.id);
                    setMenuOpen(false);
                  }}>
                  На сегодня
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSnoozeWeek(alert.id);
                    setMenuOpen(false);
                  }}>
                  На 7 дней
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDismissPermanent(alert.id);
                    setMenuOpen(false);
                  }}>
                  Больше не показывать
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
