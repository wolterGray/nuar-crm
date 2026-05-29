import { CheckCircle2, X } from 'lucide-react'

function ToastStack({ notifications, onClose }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {notifications.map((notification) => (
        <article className="toast" key={notification.id}>
          <CheckCircle2 size={19} />
          <div>
            <strong>{notification.title}</strong>
            <span>{notification.message}</span>
          </div>
          <button
            aria-label="Закрыть уведомление"
            type="button"
            onClick={() => onClose(notification.id)}
          >
            <X size={16} />
          </button>
        </article>
      ))}
    </div>
  )
}

export default ToastStack
