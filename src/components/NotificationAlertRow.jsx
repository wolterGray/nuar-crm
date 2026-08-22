import {useState} from "react";
import {Button, IconButton} from "./ui/index.js";

const ACTION_LABELS = {
  calendar: "Календарь",
  client: "Клиент",
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
      className={`client-alert-row client-alert-row-unified priority-${alert.priority} type-${alert.type}`}>
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
          return (
            <Button
              key={action}
              leftIcon={ACTION_ICONS[action]}
              size="sm"
              type="button"
              variant="subtle"
              onClick={() => onAction(alert, action)}>
              {ACTION_LABELS[action]}
            </Button>
          );
        })}
        {alert.actions.includes("snooze") ? (
          <div className="client-alert-snooze">
            <IconButton
              aria-expanded={menuOpen}
              icon="eyeOff"
              label="Скрыть уведомление"
              size="sm"
              type="button"
              variant="subtle"
              onClick={() => setMenuOpen((current) => !current)}
            />
            {menuOpen ? (
              <div className="client-alert-snooze-menu">
                <Button
                  className="client-alert-snooze-menu-item"
                  fullWidth
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onSnoozeToday(alert.id);
                    setMenuOpen(false);
                  }}>
                  На сегодня
                </Button>
                <Button
                  className="client-alert-snooze-menu-item"
                  fullWidth
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onSnoozeWeek(alert.id);
                    setMenuOpen(false);
                  }}>
                  На 7 дней
                </Button>
                <Button
                  className="client-alert-snooze-menu-item"
                  fullWidth
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onDismissPermanent(alert.id);
                    setMenuOpen(false);
                  }}>
                  Больше не показывать
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
