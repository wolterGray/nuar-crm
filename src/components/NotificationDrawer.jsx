import {AnimatePresence, motion} from "framer-motion";
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useSwipeable} from "react-swipeable";
import {
  ALERT_GROUP_LABELS,
  filterAlertsByMode,
  groupAlerts,
} from "../utils/alertCenter.js";
import {
  getNotificationAlertIds,
  getNotificationDrawerCounts,
} from "../utils/notificationDrawerCounts.js";
import NotificationAggregateRow from "./NotificationAggregateRow.jsx";
import NotificationAlertRow from "./NotificationAlertRow.jsx";
import {Button, IconButton} from "./ui/index.js";

const DESKTOP_POPOVER_WIDTH = 440;
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
    DESKTOP_POPOVER_WIDTH,
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
  {id: "urgent", label: "Внимание"},
  {id: "opportunity", label: "Возможности"},
  {id: "information", label: "История"},
];

const HISTORY_GROUP_LABELS = {
  today: "Сегодня",
  yesterday: "Вчера",
  earlier: "Ранее",
};

const getHistoryGroup = (alert, now = new Date()) => {
  const timestamp = alert.createdAt ?? alert.meta?.notification?.archivedAt;
  const date = timestamp ? new Date(timestamp) : null;
  if (!date || Number.isNaN(date.getTime())) return "earlier";

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round((today - eventDay) / 86_400_000);
  if (dayDifference <= 0) return "today";
  if (dayDifference === 1) return "yesterday";
  return "earlier";
};

export default function NotificationDrawer({
  alertFilter,
  allAlerts,
  alerts,
  animationsEnabled,
  isOpen,
  onAction,
  onDismissPermanent,
  onFilterChange,
  onRestoreSnooze,
  onSnoozeReview,
  onSnoozeToday,
  onSnoozeWeek,
  onToggleOpen,
  quietHoursActive,
  serverConnected,
  serverCounts,
  theme = "dark",
}) {
  const buttonRef = useRef(null);
  const swipeUndoTimerRef = useRef(null);
  const wasOpenRef = useRef(isOpen);
  const [locallyHiddenAlerts, setLocallyHiddenAlerts] = useState({});
  const [localNow, setLocalNow] = useState(() => Date.now());
  const [popoverStyle, setPopoverStyle] = useState({});
  const [swipeUndo, setSwipeUndo] = useState(null);
  const transition = {duration: animationsEnabled ? 0.18 : 0};
  const {
    alertsCount: localAlertsCount,
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
  const {
    badgeCount: localBadgeCount,
    totalAlertsCount: globalTotalAlertsCount,
    urgentAlertsCount: globalUrgentAlertsCount,
    visibleAlerts: globalVisibleAlerts,
  } = useMemo(
    () =>
      getNotificationDrawerCounts({
        alerts: allAlerts ?? alerts,
        locallyHiddenAlerts,
        now: localNow,
      }),
    [allAlerts, alerts, localNow, locallyHiddenAlerts],
  );
  const notificationCenterV2Enabled = import.meta.env.VITE_NOTIFICATION_CENTER_V2 !== "false";
  const badgeCount = notificationCenterV2Enabled && serverCounts
    ? Number(serverCounts.attention) || 0
    : localBadgeCount;
  const effectiveUrgentAlertsCount = notificationCenterV2Enabled && serverCounts
    ? Number(serverCounts.attention) || 0
    : globalUrgentAlertsCount;
  const groupedAlerts = useMemo(() => {
    if (alertFilter !== "information") return groupAlerts(localVisibleAlerts);

    return localVisibleAlerts.reduce((groups, alert) => {
      const key = getHistoryGroup(alert);
      groups.set(key, [...(groups.get(key) ?? []), alert]);
      return groups;
    }, new Map());
  }, [alertFilter, localVisibleAlerts]);
  const underlyingObjectCount = useMemo(
    () => localVisibleAlerts.reduce(
      (total, alert) => total + (alert.type === "aggregate" ? alert.children.length : 1),
      0,
    ),
    [localVisibleAlerts],
  );
  const filterCounts = useMemo(
    () => {
      if (notificationCenterV2Enabled && serverCounts) {
        return {
          urgent: Number(serverCounts.attention) || 0,
          opportunity: Number(serverCounts.opportunity) || 0,
          information: Number(serverCounts.information) || 0,
        };
      }

      return FILTER_OPTIONS.reduce((counts, option) => {
        counts[option.id] = filterAlertsByMode(
          globalVisibleAlerts,
          option.id,
        ).length;
        return counts;
      }, {});
    },
    [globalVisibleAlerts, notificationCenterV2Enabled, serverCounts],
  );
  const urgentAlerts = globalVisibleAlerts.filter(
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

  useEffect(() => {
    const openedNow = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (
      openedNow &&
      alertFilter !== "urgent" &&
      localAlertsCount === 0 &&
      effectiveUrgentAlertsCount > 0
    ) {
      onFilterChange("urgent");
    }
  }, [
    alertFilter,
    effectiveUrgentAlertsCount,
    isOpen,
    localAlertsCount,
    onFilterChange,
  ]);

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
  }, [isOpen, localAlertsCount, alertFilter, quietHoursActive]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setLocalNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onToggleOpen();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onToggleOpen]);

  useEffect(() => {
    if (!isOpen || !isMobilePopover) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobilePopover, isOpen]);

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

  const defaultGroupOrder = [
    "closing",
    "calendar",
    "finance",
    "operations",
    "packages",
    "birthdays",
    "inactive",
    "forecast",
    "system",
  ];
  const groupOrder = alertFilter === "information"
    ? ["today", "yesterday", "earlier"]
    : defaultGroupOrder;
  const groupLabels = alertFilter === "information"
    ? HISTORY_GROUP_LABELS
    : ALERT_GROUP_LABELS;

  const renderAlert = (alert) => {
    if (alert.type === "aggregate") {
      return (
        <NotificationAggregateRow
          alert={alert}
          key={alert.id}
          onAction={onAction}
          onDismissPermanent={onDismissPermanent}
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
        onDismissPermanent={onDismissPermanent}
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
                {serverConnected === null
                  ? "Загрузка событий…"
                  : serverConnected === false
                    ? "Нет связи с сервером"
                    : effectiveUrgentAlertsCount > 0
                  ? `${effectiveUrgentAlertsCount} требуют внимания`
                  : "Всё в порядке"}
              </p>
            </div>
            <div className="client-alert-heading-actions">
              <IconButton
                icon="x"
                label="Закрыть уведомления"
                size="sm"
                type="button"
                variant="ghost"
                onClick={onToggleOpen}
              />
            </div>
          </div>

          <div className="client-alert-toolbar">
            <span>
              {alertFilter === "opportunity"
                ? `${underlyingObjectCount} объектов · ${localVisibleAlerts.length} групп`
                : alertFilter === "urgent"
                  ? `${underlyingObjectCount} актуальных вопросов`
                  : `${underlyingObjectCount} событий`}
            </span>
            <Button
              className={alertFilter === "all" ? "client-alert-all-filter active" : "client-alert-all-filter"}
              size="sm"
              type="button"
              variant="ghost"
              onClick={() => onFilterChange("all")}>
              Показать: все
            </Button>
          </div>

          {quietHoursActive ? (
            <div className="client-alert-quiet-note">
              Тихий режим · показываются только срочные события
            </div>
          ) : null}

          <div className="client-alert-filter-chips" role="tablist" aria-label="Разделы уведомлений">
            {FILTER_OPTIONS.map((option) => (
              <Button
                aria-selected={alertFilter === option.id}
                className={alertFilter === option.id ? "active" : ""}
                key={option.id}
                role="tab"
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => onFilterChange(option.id)}>
                <span className="client-alert-filter-label">{option.label}</span>
                {filterCounts[option.id] > 0 ? (
                  <span className="client-alert-filter-count">
                    {filterCounts[option.id]}
                  </span>
                ) : null}
              </Button>
            ))}
          </div>

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
                  {alertFilter !== "opportunity" ? (
                    <div className="client-alert-group-heading">
                      {groupLabels[groupKey] ?? groupKey}
                      {groupAlertsList.length > 1 ? <b>{groupAlertsList.length}</b> : null}
                    </div>
                  ) : null}
                  <AnimatePresence initial={false}>
                    {groupAlertsList.map((alert) => renderAlert(alert))}
                  </AnimatePresence>
                </motion.div>
              );
            })}

            {localAlertsCount === 0 && (
              <div className="client-alert-empty">
                <strong>{alertFilter === "urgent" ? "Всё в порядке" : "Событий нет"}</strong>
                <span>
                {alertFilter === "urgent"
                  ? "Сейчас нет вопросов, требующих внимания."
                  : alertFilter === "closing"
                    ? "Незакрытых прошедших визитов нет."
                  : alertFilter === "finance"
                    ? "Финансовых ошибок нет."
                  : alertFilter === "clients"
                    ? "Клиентских уведомлений нет."
                    : alertFilter === "operations"
                      ? "Операционных уведомлений нет."
                      : "Сейчас здесь нет новых уведомлений."}
                </span>
              </div>
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
          badgeClassName={effectiveUrgentAlertsCount > 0 && !onlyCalendarUrgentAlerts ? undefined : "client-alert-button-info"}
          className="client-alert-button notification-trigger"
          icon="bell"
          label={
            effectiveUrgentAlertsCount > 0
              ? `Уведомления: ${effectiveUrgentAlertsCount} требуют внимания`
              : globalTotalAlertsCount > 0
                ? `Уведомления: ${globalTotalAlertsCount}`
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
