import {AnimatePresence, motion} from "framer-motion";
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useSwipeable} from "react-swipeable";
import {ALERT_GROUP_LABELS, groupAlerts} from "../utils/alertCenter.js";
import {
  getNotificationAlertIds,
  getNotificationDrawerCounts,
} from "../utils/notificationDrawerCounts.js";
import NotificationAggregateRow from "./NotificationAggregateRow.jsx";
import NotificationAlertRow from "./NotificationAlertRow.jsx";
import {AppIcon, Button, IconButton} from "./ui/index.js";

const POPOVER_WIDTH = 360;
const POPOVER_GAP = 8;
const VIEWPORT_PADDING = 16;
const LOCAL_HIDE_MS = 30 * 60 * 1000;
const LOCAL_HIDE_DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_HIDE_WEEK_MS = 7 * LOCAL_HIDE_DAY_MS;
const SWIPE_UNDO_MS = 4200;
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
  animationsEnabled,
  isOpen,
  onAction,
  onFilterChange,
  onRestoreSnooze,
  onSnoozeReview,
  onSnoozeToday,
  onSnoozeWeek,
  onToggleOpen,
  quietHoursActive,
  theme = "dark",
}) {
  const buttonRef = useRef(null);
  const swipeUndoTimerRef = useRef(null);
  const [locallyHiddenAlerts, setLocallyHiddenAlerts] = useState({});
  const [localNow, setLocalNow] = useState(() => Date.now());
  const [popoverStyle, setPopoverStyle] = useState({});
  const [swipeUndo, setSwipeUndo] = useState(null);
  const transition = {duration: animationsEnabled ? 0.18 : 0};
  const {
    badgeCount,
    alertsCount: localAlertsCount,
    totalAlertsCount: localTotalAlertsCount,
    urgentAlertsCount: localUrgentAlertsCount,
    visibleAlerts: localVisibleAlerts,
  } = useMemo(
    () =>
      getNotificationDrawerCounts({
        alerts,
        locallyHiddenAlerts,
        now: localNow,
      }),
    [alerts, localNow, locallyHiddenAlerts],
  );
  const groupedAlerts = groupAlerts(localVisibleAlerts);
  const urgentAlerts = localVisibleAlerts.filter(
    (alert) => alert.priority === "critical" || alert.priority === "action",
  );
  const onlyCalendarUrgentAlerts =
    urgentAlerts.length > 0 && urgentAlerts.every((alert) => alert.type === "calendar");
  const isMobilePopover =
    typeof window !== "undefined" && window.innerWidth <= MOBILE_MAX_WIDTH;
  const panelSwipeHandlers = useSwipeable({
    delta: 112,
    onSwipedDown: ({absY, velocity}) => {
      if (!isMobilePopover) {
        return;
      }

      if (absY >= 128 || velocity >= 0.72) {
        onToggleOpen();
      }
    },
    preventScrollOnSwipe: false,
    swipeDuration: 520,
    trackMouse: false,
    trackTouch: isMobilePopover,
  });

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
  }, [isOpen, localAlertsCount, alertFilter, quietHoursActive, localTotalAlertsCount]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setLocalNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [isOpen]);

  useEffect(
    () => () => {
      if (swipeUndoTimerRef.current) {
        window.clearTimeout(swipeUndoTimerRef.current);
      }
    },
    [],
  );

  const hideLocally = (alert, durationMs = LOCAL_HIDE_MS) => {
    const alertIds = getNotificationAlertIds(alert);

    if (alertIds.length === 0) {
      return;
    }

    const now = Date.now();
    const hiddenUntil = now + durationMs;
    setLocalNow(now);
    setLocallyHiddenAlerts((current) => {
      const next = {...current};
      alertIds.forEach((alertId) => {
        next[alertId] = hiddenUntil;
      });
      return next;
    });
  };

  const clearLocalHide = (alertIds) => {
    if (alertIds.length === 0) {
      return;
    }

    setLocalNow(Date.now());
    setLocallyHiddenAlerts((current) => {
      const next = {...current};
      alertIds.forEach((alertId) => {
        delete next[alertId];
      });
      return next;
    });
  };

  const queueSwipeUndo = (undoState) => {
    if (swipeUndoTimerRef.current) {
      window.clearTimeout(swipeUndoTimerRef.current);
    }

    setSwipeUndo(undoState);
    swipeUndoTimerRef.current = window.setTimeout(() => {
      setSwipeUndo(null);
      swipeUndoTimerRef.current = null;
    }, SWIPE_UNDO_MS);
  };

  const getSmartSnoozePlan = (alert) => {
    if (alert.type === "inactive") {
      return {
        action: onSnoozeWeek,
        durationMs: LOCAL_HIDE_WEEK_MS,
        message: "Отложено на неделю",
      };
    }

    if (["calendar", "visit"].includes(alert.type)) {
      return {
        action: onSnoozeReview,
        durationMs: LOCAL_HIDE_MS,
        message: "Отложено на ревизию",
      };
    }

    return {
      action: onSnoozeToday ?? onSnoozeReview,
      durationMs: LOCAL_HIDE_DAY_MS,
      message: "Скрыто до конца дня",
    };
  };

  const handleSwipeAction = (alert, swipeAction) => {
    const alertIds = getNotificationAlertIds(alert);

    if (alertIds.length === 0) {
      return;
    }

    const plan =
      swipeAction === "snooze"
        ? getSmartSnoozePlan(alert)
        : {
            action: onSnoozeReview,
            durationMs: LOCAL_HIDE_MS,
            message: "Скрыто до следующей ревизии",
          };

    hideLocally(alert, plan.durationMs);
    plan.action?.(alert);
    queueSwipeUndo({alert, alertIds, message: plan.message});
  };

  const handleUndoSwipe = () => {
    if (!swipeUndo) {
      return;
    }

    clearLocalHide(swipeUndo.alertIds);
    onRestoreSnooze?.(swipeUndo.alert);
    setSwipeUndo(null);

    if (swipeUndoTimerRef.current) {
      window.clearTimeout(swipeUndoTimerRef.current);
      swipeUndoTimerRef.current = null;
    }
  };

  const handleSnoozeReview = (alert) => {
    hideLocally(alert);
    onSnoozeReview?.(alert);
  };

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
          onSwipeAction={handleSwipeAction}
          onSnoozeReview={handleSnoozeReview}
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
        onSwipeAction={handleSwipeAction}
        onSnoozeReview={handleSnoozeReview}
        onSnoozeToday={onSnoozeToday}
        onSnoozeWeek={onSnoozeWeek}
      />
    );
  };

  const popover = (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            key="notification-backdrop"
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="client-alert-backdrop"
            onClick={onToggleOpen}
          />
          <motion.div
            {...panelSwipeHandlers}
            key="notification-popover"
            animate={{opacity: 1, y: 0}}
            className={`client-alert-popover client-alert-popover-portal theme-${theme}`}
            exit={{opacity: 0, y: -6}}
            initial={{opacity: 0, y: -8}}
            style={{...popoverStyle, zIndex: 120}}
            transition={transition}
            onClick={(event) => event.stopPropagation()}>
          <div className="client-alert-heading">
            <div>
              <h2>Уведомления</h2>
              <p>
                {localUrgentAlertsCount > 0
                  ? `${localUrgentAlertsCount} срочных · ${localTotalAlertsCount} всего`
                  : "Только события, требующие внимания"}
              </p>
            </div>
            <strong>{localAlertsCount}</strong>
          </div>

          {localTotalAlertsCount > 0 || quietHoursActive ? (
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
                  <Button
                    className={alertFilter === option.id ? "active" : ""}
                    key={option.id}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => onFilterChange(option.id)}>
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <AnimatePresence>
            {swipeUndo ? (
              <motion.div
                animate={{opacity: 1, y: 0}}
                className="client-alert-swipe-undo"
                exit={{opacity: 0, y: -6}}
                initial={{opacity: 0, y: -6}}
                transition={transition}>
                <span>{swipeUndo.message}</span>
                <Button
                  size="sm"
                  type="button"
                  variant="subtle"
                  onClick={handleUndoSwipe}>
                  Отменить
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="client-alert-list">
            {groupOrder.map((groupKey) => {
              const groupAlertsList = groupedAlerts.get(groupKey);

              if (!groupAlertsList?.length) {
                return null;
              }

              return (
                <motion.div className="client-alert-group" key={groupKey} layout>
                  <div className="client-alert-group-heading">
                    {ALERT_GROUP_LABELS[groupKey] ?? groupKey}
                    <b>{groupAlertsList.length}</b>
                    <AppIcon className="open" name="chevronDown" size="xs" />
                  </div>
                  <AnimatePresence initial={false}>
                    {groupAlertsList.map((alert) => renderAlert(alert))}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {localAlertsCount === 0 && (
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
        </>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div
      className="page-header-actions"
      onClick={(event) => event.stopPropagation()}>
      <div className="client-alert-control">
        <IconButton
          ref={buttonRef}
          aria-expanded={isOpen}
          badge={badgeCount > 0 ? badgeCount : null}
          badgeClassName={localUrgentAlertsCount > 0 && !onlyCalendarUrgentAlerts ? undefined : "client-alert-button-info"}
          className="client-alert-button notification-trigger"
          icon="bell"
          label={
            localUrgentAlertsCount > 0
              ? `Уведомления: ${localUrgentAlertsCount} срочных`
              : localTotalAlertsCount > 0
                ? `Уведомления: ${localTotalAlertsCount}`
                : "Центр уведомлений"
          }
          size="md"
          variant="subtle"
          onClick={onToggleOpen}
        />
        {typeof document !== "undefined"
          ? createPortal(popover, document.body)
          : null}
      </div>
    </div>
  );
}
