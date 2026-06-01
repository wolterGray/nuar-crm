import {AnimatePresence, motion} from "framer-motion";
import {CheckCircle2, X} from "lucide-react";

function ToastStack({ notifications, onClose }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {notifications.map((notification) => (
          <motion.article
            animate={{opacity: 1, x: 0, scale: 1}}
            className="toast"
            exit={{opacity: 0, x: 90, scale: 0.96}}
            initial={{opacity: 0, x: 90, scale: 0.96}}
            key={notification.id}
            transition={{duration: 0.24}}>
            <CheckCircle2 size={19} />
            <div>
              <strong>{notification.title}</strong>
              <span>{notification.message}</span>
            </div>
            <button
              aria-label="Закрыть уведомление"
              type="button"
              onClick={() => onClose(notification.id)}>
              <X size={16} />
            </button>
          </motion.article>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default ToastStack
