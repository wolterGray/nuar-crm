import {AnimatePresence, motion} from "framer-motion";
import {useEffect, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useSwipeable} from "react-swipeable";
import {AppIcon, IconButton} from "./ui/index.js";
import {MOBILE_MAX_WIDTH} from "../constants/breakpoints.js";
import styles from "./NotificationDrawer.module.css";

const DESKTOP_POPOVER_WIDTH = 400;
const POPOVER_GAP = 8;
const VIEWPORT_PADDING = 16;

const getPopoverStyle = (buttonRect) => {
  if (!buttonRect) {
    return {};
  }

  const isMobile = window.innerWidth <= MOBILE_MAX_WIDTH;

  if (isMobile) {
    return {
      position: "fixed",
      left: 0,
      right: 0,
      bottom: 0,
      top: "auto",
      width: "100%",
      maxHeight: "85dvh",
    };
  }

  const width = Math.min(
    DESKTOP_POPOVER_WIDTH,
    window.innerWidth - VIEWPORT_PADDING * 2,
  );

  let right = window.innerWidth - buttonRect.right;
  if (right < VIEWPORT_PADDING) {
    right = VIEWPORT_PADDING;
  }
  if (window.innerWidth - right - width < VIEWPORT_PADDING) {
    right = window.innerWidth - width - VIEWPORT_PADDING;
  }

  const top = buttonRect.bottom + POPOVER_GAP;
  const maxHeight = Math.max(
    260,
    window.innerHeight - top - VIEWPORT_PADDING,
  );

  return {
    position: "fixed",
    top,
    right,
    left: "auto",
    width,
    maxHeight,
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
        colorClass: styles.iconBooking,
      };
    case "visit_created":
      return {
        icon: "calendar",
        colorClass: styles.iconCreated,
      };
    case "visit_rescheduled":
      return {
        icon: "calendarClock",
        colorClass: styles.iconRescheduled,
      };
    case "visit_cancelled":
      return {
        icon: "userX",
        colorClass: styles.iconCancelled,
      };
    case "waitlist_entry":
    case "waitlist_active":
    case "waitlist_match":
    case "waitlist":
      return {
        icon: "userPlus",
        colorClass: styles.iconWaitlist,
      };
    case "supply_out_of_stock":
      return {
        icon: "alertTriangle",
        colorClass: styles.iconCancelled,
      };
    case "supply_low_stock":
    case "supply":
      return {
        icon: "package",
        colorClass: styles.iconSupply,
      };
    default:
      return {
        icon: "bell",
        colorClass: styles.iconDefault,
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
}) {
  const buttonRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState({});
  const [now, setNow] = useState(() => new Date());

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
            transition={{duration: animationsEnabled ? 0.15 : 0}}
            className={styles.backdrop}
            onClick={onToggleOpen}
          />
          <motion.div
            {...panelSwipeHandlers}
            key="notification-popover"
            initial={
              isMobilePopover
                ? {opacity: 0, y: "100%"}
                : {opacity: 0, y: -6, scale: 0.98}
            }
            animate={
              isMobilePopover
                ? {opacity: 1, y: 0}
                : {opacity: 1, y: 0, scale: 1}
            }
            exit={
              isMobilePopover
                ? {opacity: 0, y: "100%"}
                : {opacity: 0, y: -4, scale: 0.98}
            }
            transition={
              animationsEnabled
                ? isMobilePopover
                  ? {type: "spring", damping: 28, stiffness: 320}
                  : {duration: 0.16, ease: [0.16, 1, 0.3, 1]}
                : {duration: 0}
            }
            className={styles.popover}
            style={{...popoverStyle, zIndex: 120}}
            onClick={(event) => event.stopPropagation()}>
            {isMobilePopover && <div className={styles.mobileHandle} />}

            <div className={styles.header}>
              <div className={styles.titleRow}>
                <h2 className={styles.title}>Уведомления</h2>
                {alerts.length > 0 ? (
                  <span className={styles.badgeActive}>{alerts.length}</span>
                ) : (
                  <span className={styles.badgeIdle}>0</span>
                )}
              </div>
              <div className={styles.headerActions}>
                {alerts.length > 0 && onDismissPermanent ? (
                  <button
                    type="button"
                    className={styles.clearAllBtn}
                    onClick={() => {
                      alerts.forEach((alert) => onDismissPermanent?.(alert));
                    }}>
                    <AppIcon name="checkCheck" size="sm" />
                    <span>Очистить все</span>
                  </button>
                ) : null}
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

            <div className={styles.list}>
              {alerts.length > 0 ? (
                <AnimatePresence initial={false}>
                  {alerts.map((alert) => {
                    const iconInfo = getNotificationIconInfo(alert.type);
                    const relativeTime = formatRelativeTime(alert.createdAt, now);
                    const isUnviewed = alert.isUnviewed || alert.status === "new";

                    return (
                      <motion.div
                        className={`${styles.row} ${isUnviewed ? styles.rowUnviewed : ""}`}
                        key={alert.id}
                        layout
                        initial={{opacity: 0, y: 4}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, height: 0, marginBottom: 0, overflow: "hidden"}}
                        transition={{duration: animationsEnabled ? 0.15 : 0}}
                        role="button"
                        tabIndex={0}
                        onClick={() => onAction?.(alert, "open")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onAction?.(alert, "open");
                          }
                        }}>
                        <div className={`${styles.iconBox} ${iconInfo.colorClass}`}>
                          <AppIcon name={iconInfo.icon} size={18} />
                        </div>

                        <div className={styles.contentBox}>
                          <div className={styles.headerLine}>
                            <div className={styles.titleWrap}>
                              {isUnviewed ? <span className={styles.unviewedDot} /> : null}
                              <strong className={styles.rowTitle}>{alert.title}</strong>
                            </div>
                            {relativeTime ? (
                              <time className={styles.time}>{relativeTime}</time>
                            ) : null}
                          </div>

                          <div className={styles.message}>
                            {alert.message}
                          </div>
                        </div>

                        <div
                          className={styles.dismissBox}
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
                            className={styles.dismissBtn}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              ) : (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIconWrap}>
                    <AppIcon name="bellOff" size={24} />
                  </div>
                  <strong className={styles.emptyTitle}>Все уведомления прочитаны</strong>
                  <p className={styles.emptyDesc}>
                    Новые записи с сайта, переносы и важные события студии появятся здесь
                  </p>
                </div>
              )}
            </div>

            {serverConnected === false ? (
              <div className={styles.serverWarning}>
                <AppIcon name="alertTriangle" size="xs" />
                <span>Нет связи с сервером уведомлений</span>
              </div>
            ) : null}
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
