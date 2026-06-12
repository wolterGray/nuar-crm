import {ChevronDown, EyeOff, MoreHorizontal} from "lucide-react";
import {useState} from "react";
import NotificationAlertRow from "./NotificationAlertRow.jsx";

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
            <ChevronDown className={expanded ? "open" : ""} size={14} />
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
          <button type="button" onClick={() => onAction(alert, "open")}>
            Открыть
          </button>
          <div className="client-alert-snooze">
            <button
              aria-expanded={menuOpen}
              aria-label="Скрыть группу"
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
