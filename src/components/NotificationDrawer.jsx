import {AnimatePresence, motion} from "framer-motion";
import {Bell, ChevronDown} from "lucide-react";
import {useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {ALERT_GROUP_LABELS, groupAlerts} from "../utils/alertCenter.js";
import NotificationAggregateRow from "./NotificationAggregateRow.jsx";
import NotificationAlertRow from "./NotificationAlertRow.jsx";

const POPOVER_WIDTH = 360;
const POPOVER_GAP = 8;
const VIEWPORT_PADDING = 16;
import {MOBILE_MAX_WIDTH} from "../constants/breakpoints.js";

const getPopoverStyle = (buttonRect) => {
  if (!buttonRect) {
    return {};
  }

  const isMobile = window.innerWidth <= MOBILE_MAX_WIDTH;

  if (isMobile) {
    const top = buttonRect.bottom + POPOVER_GAP;
    const maxHeight = Math.max(
      180,
      window.innerHeight - top - VIEWPORT_PADDING,
    );

    return {
      left: VIEWPORT_PADDING,
      maxHeight,
      position: "fixed",
      right: VIEWPORT_PADDING,
      top,
      width: "auto",
    };
  }

  const width = Math.min(
    POPOVER_WIDTH,
    window.innerWidth - VIEWPORT_PADDING * 2,
  );
  let left = buttonRect.right - width;
  left = Math.max(
    VIEWPORT_PADDING,
    Math.min(left, window.innerWidth - width - VIEWPORT_PADDING),
  );
  const top = buttonRect.bottom + POPOVER_GAP;
  const maxHeight = Math.max(
    220,
    window.innerHeight - top - VIEWPORT_PADDING,
  );

  return {
    left,
    maxHeight,
    position: "fixed",
    right: "auto",
    top,
    width,
  };
};

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
  theme = "dark",
  totalAlertsCount,
  urgentAlertsCount,
}) {
  const buttonRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState({});
  const transition = {duration: animationsEnabled ? 0.18 : 0};
  const groupedAlerts = groupAlerts(alerts);

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) {
      return undefined;
    }

    const updatePosition = () => {
      setPopoverStyle(getPopoverStyle(buttonRef.current.getBoundingClientRect()));
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, alertsCount, alertFilter, quietHoursActive, totalAlertsCount]);
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

  const popover = (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{opacity: 1, y: 0}}
          className={`client-alert-popover client-alert-popover-portal theme-${theme}`}
          exit={{opacity: 0, y: -6}}
          initial={{opacity: 0, y: -8}}
          style={popoverStyle}
          transition={transition}
          onClick={(event) => event.stopPropagation()}>
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
      ) : null}
    </AnimatePresence>
  );

  return (
    <div
      className="page-header-actions"
      onClick={(event) => event.stopPropagation()}>
      <div className="client-alert-control">
        <button
          ref={buttonRef}
          aria-expanded={isOpen}
          aria-label={
            urgentAlertsCount > 0
              ? `Уведомления: ${urgentAlertsCount} срочных`
              : totalAlertsCount > 0
                ? `Уведомления: ${totalAlertsCount}`
                : "Центр уведомлений"
          }
          className="client-alert-button notification-trigger"
          type="button"
          onClick={onToggleOpen}>
          <Bell size={18} />
          {urgentAlertsCount > 0 ? (
            <b>{urgentAlertsCount}</b>
          ) : totalAlertsCount > 0 ? (
            <b className="client-alert-button-info">{totalAlertsCount}</b>
          ) : null}
        </button>
        {typeof document !== "undefined"
          ? createPortal(popover, document.body)
          : null}
      </div>
    </div>
  );
}
