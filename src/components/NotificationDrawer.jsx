import {AnimatePresence, motion} from "framer-motion";
import {Bell, ChevronDown} from "lucide-react";
import {ALERT_GROUP_LABELS, groupAlerts} from "../utils/alertCenter.js";
import NotificationAggregateRow from "./NotificationAggregateRow.jsx";
import NotificationAlertRow from "./NotificationAlertRow.jsx";

const FILTER_OPTIONS = [
  {id: "urgent", label: "Срочные"},
  {id: "all", label: "Все"},
  {id: "operations", label: "Склад"},
  {id: "clients", label: "Клиенты"},
];

export default function NotificationDrawer({
  alertFilter,
  alertSummary,
  alerts,
  alertsCount,
  animationsEnabled,
  isOpen,
  onAction,
  onDismissPermanent,
  onFilterChange,
  onSnoozeToday,
  onSnoozeWeek,
  onToggleOpen,
  quietHoursActive,
  totalAlertsCount,
  urgentAlertsCount,
}) {
  const transition = {duration: animationsEnabled ? 0.18 : 0};
  const groupedAlerts = groupAlerts(alerts);
  const groupOrder = [
    "calendar",
    "operations",
    "packages",
    "birthdays",
    "inactive",
    "forecast",
    "system",
  ];

  const renderAlert = (alert) => {
    if (alert.type === "aggregate") {
      return (
        <NotificationAggregateRow
          alert={alert}
          key={alert.id}
          onAction={onAction}
          onDismissPermanent={onDismissPermanent}
          onSnoozeToday={onSnoozeToday}
          onSnoozeWeek={onSnoozeWeek}
        />
      );
    }

    return (
      <NotificationAlertRow
        alert={alert}
        key={alert.id}
        onAction={onAction}
        onDismissPermanent={onDismissPermanent}
        onSnoozeToday={onSnoozeToday}
        onSnoozeWeek={onSnoozeWeek}
      />
    );
  };

  return (
    <div
      className="page-header-actions"
      onClick={(event) => event.stopPropagation()}>
      <div className="client-alert-control">
        <button
          aria-label="Центр уведомлений"
          className="client-alert-button"
          type="button"
          onClick={onToggleOpen}>
          <Bell size={18} />
          {urgentAlertsCount > 0 ? <b>{urgentAlertsCount}</b> : null}
          {urgentAlertsCount > 0 && totalAlertsCount > urgentAlertsCount ? (
            <em>{totalAlertsCount}</em>
          ) : totalAlertsCount > 0 && urgentAlertsCount === 0 ? (
            <b className="client-alert-button-info">{totalAlertsCount}</b>
          ) : null}
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              animate={{opacity: 1, y: 0, scale: 1}}
              className="client-alert-popover"
              exit={{opacity: 0, y: -6, scale: 0.98}}
              initial={{opacity: 0, y: -8, scale: 0.98}}
              transition={transition}>
              <div className="client-alert-heading">
                <div>
                  <h2>Уведомления</h2>
                  <p>
                    {urgentAlertsCount > 0
                      ? `${urgentAlertsCount} срочных · ${totalAlertsCount} всего`
                      : "Только события, требующие внимания"}
                  </p>
                </div>
                <strong>{alertsCount}</strong>
              </div>

              {totalAlertsCount > 0 || quietHoursActive ? (
                <div
                  className={`client-alert-summary-bar${quietHoursActive ? " quiet-hours" : ""}`}>
                  <div>
                    <strong>{quietHoursActive ? "Тихий режим" : "Сегодня"}</strong>
                    <span>
                      {quietHoursActive
                        ? "Показываются только срочные уведомления"
                        : `${alertSummary.visitsToday} визитов · ~${alertSummary.revenueToday} zł`}
                    </span>
                  </div>
                  <div className="client-alert-filter-chips">
                    {FILTER_OPTIONS.map((option) => (
                      <button
                        className={alertFilter === option.id ? "active" : ""}
                        key={option.id}
                        type="button"
                        onClick={() => onFilterChange(option.id)}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="client-alert-list">
                {groupOrder.map((groupKey) => {
                  const groupAlertsList = groupedAlerts.get(groupKey);

                  if (!groupAlertsList?.length) {
                    return null;
                  }

                  return (
                    <div className="client-alert-group" key={groupKey}>
                      <div className="client-alert-group-heading">
                        {ALERT_GROUP_LABELS[groupKey] ?? groupKey}
                        <b>{groupAlertsList.length}</b>
                        <ChevronDown className="open" size={14} />
                      </div>
                      {groupAlertsList.map((alert) => renderAlert(alert))}
                    </div>
                  );
                })}

                {alertsCount === 0 && (
                  <p className="client-alert-empty">
                    {alertFilter === "urgent"
                      ? "Срочных уведомлений нет."
                      : alertFilter === "clients"
                        ? "Клиентских уведомлений нет."
                        : alertFilter === "operations"
                          ? "Операционных уведомлений нет."
                          : "Сейчас нет новых уведомлений."}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
