import {AnimatePresence, motion} from "framer-motion";
import {AppIcon, Button, IconButton} from "./ui/index.js";

const SWIPE_DISMISS_OFFSET = 86;
const SWIPE_DISMISS_VELOCITY = 620;

function ToastStack({notifications, onAction, onClose}) {
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {notifications.map((notification) => {
          const iconName = notification.tone === "urgent" ? "alert" : "check";

          return (
            <motion.article
              animate={{opacity: 1, x: 0, scale: 1}}
              className={`toast ${notification.tone === "urgent" ? "toast-urgent" : ""}`}
              drag="x"
              dragConstraints={{left: 0, right: 0}}
              dragElastic={0.24}
              exit={{opacity: 0, x: 90, scale: 0.96}}
              initial={{opacity: 0, x: 90, scale: 0.96}}
              key={notification.id}
              transition={{duration: 0.24}}
              whileDrag={{scale: 0.985}}
              onDragEnd={(_, info) => {
                if (
                  Math.abs(info.offset.x) > SWIPE_DISMISS_OFFSET ||
                  Math.abs(info.velocity.x) > SWIPE_DISMISS_VELOCITY
                ) {
                  onClose(notification.id);
                }
              }}>
              <AppIcon name={iconName} size="lg" />
              <div>
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                {notification.actions?.length ? (
                  <div className="toast-actions">
                    {notification.actions.map((actionItem) => (
                      <Button
                        key={`${actionItem.action}-${actionItem.label}`}
                        size="sm"
                        type="button"
                        variant="subtle"
                        onClick={() => onAction?.(notification, actionItem)}>
                        {actionItem.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
              <IconButton
                icon="x"
                label="Закрыть уведомление"
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => onClose(notification.id)}
              />
            </motion.article>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default ToastStack;
