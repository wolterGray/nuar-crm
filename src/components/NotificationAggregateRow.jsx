import {animate, motion, useMotionValue} from "framer-motion";
import {useState} from "react";
import {useSwipeable} from "react-swipeable";
import NotificationAlertRow from "./NotificationAlertRow.jsx";
import {AppIcon, Button} from "./ui/index.js";

const SWIPE_CONFIRM_DELTA = 76;
const SWIPE_HINT_LIMIT = 92;
const SWIPE_REVEAL_OFFSET = 86;
const CHILD_PAGE_SIZE = 12;

const getAggregateTitle = (alert) => {
  return alert.title;
};

export default function NotificationAggregateRow({
  alert,
  onAction,
  onDismissPermanent,
  onSwipeAction,
  onSnoozeReview,
  onSnoozeToday,
}) {
  const [expanded, setExpanded] = useState(false);
  const [visibleChildren, setVisibleChildren] = useState(CHILD_PAGE_SIZE);
  const [armedDirection, setArmedDirection] = useState(0);
  const [dismissDirection, setDismissDirection] = useState(0);
  const [swipeHint, setSwipeHint] = useState(null);
  const swipeX = useMotionValue(0);
  const displayTitle = getAggregateTitle(alert);
  const snoozeBySwipe = () => (onSnoozeReview ?? onSnoozeToday)(alert);
  const dismissFromSwipe = (direction) => {
    setDismissDirection(direction);
    setArmedDirection(0);
    setSwipeHint(direction < 0 ? "close" : "snooze");

    if (onSwipeAction) {
      onSwipeAction(alert, direction < 0 ? "close" : "snooze");
      return;
    }

    snoozeBySwipe();
  };
  const resetSwipeReveal = () => {
    setArmedDirection(0);
    setSwipeHint(null);
    animate(swipeX, 0, {duration: 0.18, ease: "easeOut"});
  };
  const revealSwipeAction = (direction) => {
    setArmedDirection(direction);
    setSwipeHint(direction < 0 ? "close" : "snooze");
    animate(swipeX, direction * SWIPE_REVEAL_OFFSET, {
      duration: 0.18,
      ease: "easeOut",
    });
  };
  const swipeHandlers = useSwipeable({
    delta: SWIPE_CONFIRM_DELTA,
    preventScrollOnSwipe: false,
    swipeDuration: 760,
    trackMouse: false,
    trackTouch: true,
    onSwipeStart: () => {
      if (!armedDirection) {
        setSwipeHint(null);
      }
    },
    onSwiping: ({deltaX}) => {
      const nextHint = deltaX < -18 ? "close" : deltaX > 18 ? "snooze" : null;
      const fallbackHint =
        armedDirection < 0 ? "close" : armedDirection > 0 ? "snooze" : null;
      const activeHint = nextHint ?? fallbackHint;
      const baseX = armedDirection * SWIPE_REVEAL_OFFSET;
      const clampedX = Math.max(
        -SWIPE_HINT_LIMIT,
        Math.min(SWIPE_HINT_LIMIT, baseX + deltaX),
      );

      swipeX.set(clampedX);
      setSwipeHint((current) => (current === activeHint ? current : activeHint));
    },
    onSwiped: ({dir}) => {
      const direction = dir === "Left" ? -1 : dir === "Right" ? 1 : 0;

      if (!direction) {
        if (armedDirection) {
          revealSwipeAction(armedDirection);
          return;
        }

        resetSwipeReveal();
        return;
      }

      if (!armedDirection) {
        revealSwipeAction(direction);
        return;
      }

      if (armedDirection === direction) {
        dismissFromSwipe(direction);
        return;
      }

      resetSwipeReveal();
    },
    onTap: () => {
      if (armedDirection) {
        resetSwipeReveal();
      }
    },
  });
  const shellActionClass =
    swipeHint ?? (armedDirection < 0 ? "close" : armedDirection > 0 ? "snooze" : null);

  return (
    <motion.div
      animate={
        dismissDirection
          ? {
              height: 0,
              marginTop: 0,
              opacity: 0,
              paddingBottom: 0,
              paddingTop: 0,
              x: dismissDirection * 360,
            }
          : {opacity: 1, x: 0}
      }
      className={`client-alert-swipe-shell client-alert-aggregate category-${alert.category ?? "information"} ${shellActionClass ? `is-${shellActionClass}` : ""}`}
      exit={{
        height: 0,
        marginTop: 0,
        opacity: 0,
        paddingBottom: 0,
        paddingTop: 0,
        x: dismissDirection * 360 || 220,
      }}
      layout
      style={{overflow: "hidden"}}
      transition={{duration: dismissDirection ? 0.2 : 0.18, ease: "easeOut"}}>
      <div className="client-alert-aggregate-head" {...swipeHandlers}>
        <div className="client-alert-swipe-underlay">
          <span className="client-alert-swipe-cue is-snooze">Отложить</span>
          <span className="client-alert-swipe-cue is-close">Скрыть</span>
        </div>
        <motion.div style={{x: swipeX}}>
        <div
          className={`client-alert-row client-alert-row-unified priority-${alert.priority} aggregate-${alert.aggregateKind ?? alert.group}`}
        >
          <div className="client-alert-row-main">
            <Button
              className="client-alert-aggregate-toggle"
              type="button"
              variant="ghost"
              onClick={() => setExpanded((current) => !current)}>
              <div className="client-alert-row-copy">
                <strong>{displayTitle}</strong>
                <span>{alert.message}</span>
              </div>
              <AppIcon className={expanded ? "open" : ""} name="chevronDown" size="sm" />
            </Button>
          </div>
        </div>
        </motion.div>
      </div>
      {expanded ? (
          <motion.div
            animate={{height: "auto", opacity: 1}}
            className="client-alert-aggregate-children"
            initial={{height: 0, opacity: 0}}
            transition={{duration: 0.18, ease: "easeOut"}}
            onPointerDown={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}>
            {alert.children.slice(0, visibleChildren).map((childAlert) => (
              <NotificationAlertRow
                alert={childAlert}
                key={childAlert.id}
                onAction={onAction}
                onDismissPermanent={onDismissPermanent}
                onSwipeAction={onSwipeAction}
                onSnoozeReview={onSnoozeReview}
                onSnoozeToday={onSnoozeToday}
              />
            ))}
            {visibleChildren < alert.children.length ? (
              <Button
                className="client-alert-load-more"
                type="button"
                variant="ghost"
                onClick={() => setVisibleChildren((current) => current + CHILD_PAGE_SIZE)}>
                Показать ещё · {alert.children.length - visibleChildren}
              </Button>
            ) : null}
          </motion.div>
        ) : null}
    </motion.div>
  );
}
