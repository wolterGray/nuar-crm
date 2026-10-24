import {AnimatePresence, motion} from "framer-motion";
import {useEffect, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useSwipeable} from "react-swipeable";
import {AppIcon, IconButton} from "./ui/index.js";
import {MOBILE_MAX_WIDTH} from "../constants/breakpoints.js";

const DESKTOP_POPOVER_WIDTH = 440;
const POPOVER_GAP = 8;
const VIEWPORT_PADDING = 16;

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

const formatRelativeTime = (timestamp, now = new Date()) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60 * 1000) return "только что";
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  if (diffMinutes < 60) return `${diffMinutes} мин назад`;
  const diffHours = Math.floor(diffMs / (3600 * 1000));
  if (diffHours < 24) return `${diffHours} ч назад`;
  const diffDays = Math.floor(diffMs / (86400 * 1000));
  if (diffDays === 1) return "вчера";
  if (diffDays < 7) return `${diffDays} дн назад`;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Warsaw",
  }).format(date);
};

const getNotificationIconInfo = (type) => {
  switch (type) {
    case "site_booking_request":
    case "booking_request":
    case "site_booking":
      return {
        icon: "calendarPlus",
        colorClass: "notif-icon-booking",
      };
    case "visit_created":
      return {
        icon: "calendar",
        colorClass: "notif-icon-created",
      };
    case "visit_rescheduled":
      return {
        icon: "calendarClock",
        colorClass: "notif-icon-rescheduled",
      };
    case "visit_cancelled":
      return {
        icon: "userX",
        colorClass: "notif-icon-cancelled",
      };
    case "waitlist_entry":
    case "waitlist_active":
    case "waitlist_match":
    case "waitlist":
      return {
        icon: "userPlus",
        colorClass: "notif-icon-waitlist",
      };
    case "supply_out_of_stock":
      return {
        icon: "alert",
        colorClass: "notif-icon-danger",
      };
    case "supply_low_stock":
    case "supply":
      return {
        icon: "package",
        colorClass: "notif-icon-warning",
      };
    default:
      return {
        icon: "bell",
        colorClass: "notif-icon-default",
      };
  }
};

export default function NotificationDrawer({
  alerts = [],
  animationsEnabled = true,
  isOpen = false,
  onAction,
  onDismissPermanent,
  onToggleOpen,
  serverConnected,
  serverCounts,
  theme = "dark",
}) {
  const buttonRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState({});
  const [now, setNow] = useState(() => new Date());
  const transition = {duration: animationsEnabled ? 0.18 : 0};

  const badgeCount = serverCounts
    ? Number(serverCounts.attention ?? serverCounts.total) || alerts.length
    : alerts.length;

  const isMobilePopover =
    typeof window !== "undefined" && window.innerWidth <= MOBILE_MAX_WIDTH;

  const panelSwipeHandlers = useSwipeable({
    delta: 112,
    onSwipedDown: ({absY, velocity}) => {
      if (!isMobilePopover) return;
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
    if (!isOpen || !buttonRef.current) return undefined;

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
  }, [isOpen, alerts.length]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const timer = window.setInterval(() => {
      setNow(new Date());
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
                  {serverConnected === false
                    ? "Нет связи с сервером"
                    : alerts.length > 0
                      ? `${alerts.length} ${alerts.length === 1 ? "событие" : alerts.length < 5 ? "события" : "событий"}`
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

            <div className="client-alert-list notif-single-stream-list">
              {alerts.length > 0 ? (
                <AnimatePresence initial={false}>
                  {alerts.map((alert) => {
                    const iconInfo = getNotificationIconInfo(alert.type);
                    const relativeTime = formatRelativeTime(alert.createdAt, now);
                    const isUnviewed = alert.isUnviewed || alert.status === "new";

                    return (
                      <motion.div
                        className="notif-stream-row"
                        key={alert.id}
                        layout
                        initial={{opacity: 0, y: 4}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, height: 0, marginBottom: 0, overflow: "hidden"}}
                        transition={transition}
                        role="button"
                        tabIndex={0}
                        onClick={() => onAction?.(alert, "open")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onAction?.(alert, "open");
                          }
                        }}>
                        <div className={`notif-icon-box ${iconInfo.colorClass}`}>
                          <AppIcon name={iconInfo.icon} size={18} />
                        </div>

                        <div className="notif-content-box">
                          <div className="notif-header-line">
                            <div className="notif-title-wrap">
                              {isUnviewed ? <span className="notif-unviewed-dot" /> : null}
                              <strong className="notif-title">{alert.title}</strong>
                            </div>
                            {relativeTime ? (
                              <time className="notif-time">{relativeTime}</time>
                            ) : null}
                          </div>

                          <div className="notif-message-text">
                            {alert.message}
                          </div>
                        </div>

                        <div
                          className="notif-dismiss-box"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDismissPermanent?.(alert);
                          }}>
                          <IconButton
                            icon="x"
                            label="Убрать уведомление"
                            size="sm"
                            type="button"
                            variant="ghost"
                            className="notif-dismiss-btn"
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              ) : (
                <div className="client-alert-empty notif-empty-state">
                  <div className="notif-empty-icon-wrap">
                    <AppIcon name="badgeCheck" size={28} />
                  </div>
                  <strong>Всё в порядке ✓</strong>
                  <span>Нет новых событий, требующих внимания.</span>
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
          className="client-alert-button notification-trigger"
          icon="bell"
          label={
            badgeCount > 0
              ? `Уведомления: ${badgeCount}`
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
