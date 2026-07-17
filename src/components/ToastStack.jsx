import {AnimatePresence, motion} from "framer-motion";
import AppIcon from "./ui/AppIcon.jsx";
import IconButton from "./ui/IconButton.jsx";

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
              exit={{opacity: 0, x: 90, scale: 0.96}}
              initial={{opacity: 0, x: 90, scale: 0.96}}
              key={notification.id}
              transition={{duration: 0.24}}>
              <AppIcon name={iconName} size="lg" />
              <div>
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
                {notification.actions?.length ? (
                  <div className="toast-actions">
                    {notification.actions.map((actionItem) => (
                      <button
                        key={`${actionItem.action}-${actionItem.label}`}
                        type="button"
                        onClick={() => onAction?.(notification, actionItem)}>
                        {actionItem.label}
                      </button>
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
