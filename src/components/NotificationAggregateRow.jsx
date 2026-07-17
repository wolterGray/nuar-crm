import {useState} from "react";
import NotificationAlertRow from "./NotificationAlertRow.jsx";
import {AppIcon, Button, IconButton} from "./ui/index.js";

export default function NotificationAggregateRow({
  alert,
  onAction,
  onDismissPermanent,
  onSnoozeToday,
  onSnoozeWeek,
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="client-alert-aggregate">
      <div className={`client-alert-row client-alert-row-unified priority-${alert.priority}`}>
        <div className="client-alert-row-main">
          <button
            className="client-alert-aggregate-toggle"
            type="button"
            onClick={() => setExpanded((current) => !current)}>
            <AppIcon className={expanded ? "open" : ""} name="chevronDown" size="xs" />
            <div className="client-alert-row-copy">
              <strong>{alert.title}</strong>
              <span>{alert.message}</span>
            </div>
          </button>
          <span className={`client-alert-priority priority-${alert.priority}`}>
            {alert.children.length}
          </span>
        </div>
        <div className="client-alert-actions">
          <Button size="sm" type="button" variant="subtle" onClick={() => onAction(alert, "open")}>
            Открыть
          </Button>
          <div className="client-alert-snooze">
            <IconButton
              aria-expanded={menuOpen}
              icon="eyeOff"
              label="Скрыть группу"
              size="sm"
              type="button"
              variant="subtle"
              onClick={() => setMenuOpen((current) => !current)}
            />
            {menuOpen ? (
              <div className="client-alert-snooze-menu">
                <button
                  type="button"
                  onClick={() => {
                    onSnoozeToday(alert);
                    setMenuOpen(false);
                  }}>
                  На сегодня
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSnoozeWeek(alert);
                    setMenuOpen(false);
                  }}>
                  На 7 дней
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDismissPermanent(alert);
                    setMenuOpen(false);
                  }}>
                  Больше не показывать
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {expanded ? (
        <div className="client-alert-aggregate-children">
          {alert.children.map((childAlert) => (
            <NotificationAlertRow
              alert={childAlert}
              key={childAlert.id}
              onAction={onAction}
              onDismissPermanent={onDismissPermanent}
              onSnoozeToday={onSnoozeToday}
              onSnoozeWeek={onSnoozeWeek}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
