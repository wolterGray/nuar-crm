import {AnimatePresence, motion} from "framer-motion";
import {AppIcon, Button, IconButton} from "./ui/index.js";

const SWIPE_DISMISS_OFFSET = 86;
const SWIPE_DISMISS_VELOCITY = 620;
const ERROR_MARKERS = [
  "ошибка",
  "не удалось",
  "не сохран",
  "не загруж",
  "не открыт",
  "не открыта",
  "не удал",
  "не обнов",
  "не принят",
  "не отмен",
  "не очищ",
  "не отправ",
  "failed",
  "error",
];
const WARNING_MARKERS = [
  "внимание",
  "предупреж",
  "проверьте",
  "выберите",
  "укажите",
  "нужно",
  "нельзя",
  "недостаточно",
  "warning",
];
const SUCCESS_MARKERS = [
  "успеш",
  "сохран",
  "создан",
  "добавлен",
  "обнов",
  "удален",
  "удалён",
  "очищена",
  "готово",
  "success",
];

function getToastTone(notification) {
  const explicitTone = String(
    notification.tone ||
      notification.type ||
      notification.variant ||
      notification.status ||
      "",
  ).toLowerCase();

  if (["error", "danger", "urgent"].includes(explicitTone)) {
    return "error";
  }
  if (["warning", "warn"].includes(explicitTone)) {
    return "warning";
  }
  if (["success", "ok"].includes(explicitTone)) {
    return "success";
  }

  const text = `${notification.title || ""} ${notification.message || ""}`.toLowerCase();

  if (ERROR_MARKERS.some((marker) => text.includes(marker))) {
    return "error";
  }
  if (WARNING_MARKERS.some((marker) => text.includes(marker))) {
    return "warning";
  }
  if (SUCCESS_MARKERS.some((marker) => text.includes(marker))) {
    return "success";
  }

  return "success";
}

function ToastStack({notifications, onAction, onClose}) {
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {notifications.map((notification) => {
          const toastTone = getToastTone(notification);
          const iconName = toastTone === "success" ? "check" : "alert";

          return (
            <motion.article
              animate={{opacity: 1, x: 0, scale: 1}}
              className={`toast toast-${toastTone}`}
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
