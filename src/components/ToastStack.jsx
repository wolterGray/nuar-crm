import {AnimatePresence, motion} from "framer-motion";
import {AlertTriangle, CheckCircle2, X} from "lucide-react";

function ToastStack({notifications, onAction, onClose}) {
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {notifications.map((notification) => {
          const Icon =
            notification.tone === "urgent" ? AlertTriangle : CheckCircle2;

          return (
            <motion.article
              animate={{opacity: 1, x: 0, scale: 1}}
              className={`toast ${notification.tone === "urgent" ? "toast-urgent" : ""}`}
              exit={{opacity: 0, x: 90, scale: 0.96}}
              initial={{opacity: 0, x: 90, scale: 0.96}}
              key={notification.id}
              transition={{duration: 0.24}}>
              <Icon size={19} />
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
              <button
                aria-label="Закрыть уведомление"
                type="button"
                onClick={() => onClose(notification.id)}>
                <X size={16} />
              </button>
            </motion.article>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default ToastStack;
