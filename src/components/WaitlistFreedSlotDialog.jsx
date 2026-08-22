import {AnimatePresence, motion, useReducedMotion} from "framer-motion";
import {formatWaitlistSlotLabel, summarizeWaitlistEntry} from "../utils/waitlist.js";
import {Button, IconButton} from "./ui/index.js";

function WaitlistFreedSlotDialog({
  buildOfferMessage,
  matches = [],
  slot,
  onBook,
  onClose,
  onMessage,
}) {
  const shouldReduceMotion = useReducedMotion();
  const open = Boolean(slot && matches.length > 0);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={{opacity: 1}}
          className="modal-backdrop waitlist-freed-backdrop"
          exit={{opacity: 0}}
          initial={{opacity: 0}}
          transition={{duration: shouldReduceMotion ? 0.08 : 0.16, ease: "easeOut"}}
        >
          <motion.section
            animate={shouldReduceMotion ? {opacity: 1} : {opacity: 1, scale: 1, y: 0}}
            className="modal waitlist-freed-dialog"
            exit={shouldReduceMotion ? {opacity: 0} : {opacity: 0, scale: 0.96, y: 8}}
            initial={shouldReduceMotion ? {opacity: 0} : {opacity: 0, scale: 0.94, y: 14}}
            role="dialog"
            transition={{
              damping: 30,
              duration: shouldReduceMotion ? 0.08 : undefined,
              mass: 0.85,
              stiffness: 420,
              type: "spring",
            }}
          >
            <header className="modal-header">
              <div>
                <h2>Освободился слот</h2>
                <p>{formatWaitlistSlotLabel(slot)}</p>
              </div>
              <IconButton
                icon="x"
                label="Закрыть"
                size="sm"
                type="button"
                variant="ghost"
                onClick={onClose}
              />
            </header>
            <div className="waitlist-freed-list">
              <strong>Подходят из листа ожидания ({matches.length})</strong>
              <ul>
                {matches.map((entry) => (
                  <li key={entry.id}>
                    <div className="waitlist-freed-item">
                      <div>
                        <strong>{entry.clientName}</strong>
                        <span>{summarizeWaitlistEntry(entry)}</span>
                        <small>{buildOfferMessage?.(entry, slot)}</small>
                      </div>
                      <div className="waitlist-freed-actions">
                        <Button
                          leftIcon="message"
                          size="sm"
                          type="button"
                          variant="secondary"
                          onClick={() => onMessage?.(entry, slot)}>
                          Написать
                        </Button>
                        <Button
                          leftIcon="calendarPlus"
                          size="sm"
                          type="button"
                          variant="primary"
                          onClick={() => onBook?.(entry, slot)}>
                          Записать
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <footer className="modal-actions">
              <Button size="sm" type="button" variant="secondary" onClick={onClose}>
                Закрыть
              </Button>
            </footer>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default WaitlistFreedSlotDialog;
