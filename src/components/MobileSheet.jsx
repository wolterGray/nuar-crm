import {useEffect} from "react";
import {AnimatePresence, motion, useReducedMotion} from "framer-motion";
import {useModalScrollLock} from "../hooks/useModalScrollLock.js";
import IconButton from "./ui/IconButton.jsx";

function MobileSheet({
  children,
  className = "",
  footer,
  fullscreen = false,
  isOpen,
  labelledBy,
  onClose,
  title,
  description,
}) {
  const shouldReduceMotion = useReducedMotion();
  useModalScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{opacity: 1}}
          className="modal-backdrop mobile-sheet-backdrop"
          exit={{opacity: 0}}
          initial={{opacity: 0}}
          role="presentation"
          transition={{duration: shouldReduceMotion ? 0.08 : 0.18, ease: "easeOut"}}
          onClick={onClose}>
          <motion.section
            animate={shouldReduceMotion ? {opacity: 1} : {opacity: 1, scale: 1, y: 0}}
            aria-labelledby={labelledBy}
            aria-modal="true"
            className={`mobile-sheet ${fullscreen ? "mobile-sheet-fullscreen" : ""} ${className}`.trim()}
            exit={shouldReduceMotion ? {opacity: 0} : {opacity: 0, scale: 0.96, y: 18}}
            initial={shouldReduceMotion ? {opacity: 0} : {opacity: 0, scale: 0.94, y: 26}}
            role="dialog"
            transition={{
              damping: 30,
              duration: shouldReduceMotion ? 0.08 : undefined,
              mass: 0.9,
              stiffness: 420,
              type: "spring",
            }}
            onClick={(event) => event.stopPropagation()}>
            {(title || onClose) && (
              <header className="mobile-sheet-header">
                <div className="mobile-sheet-header-copy">
                  {title ? (
                    <h2 className="crm-title" id={labelledBy}>{title}</h2>
                  ) : null}
                  {description ? <p>{description}</p> : null}
                </div>
                {onClose ? (
                  <IconButton
                    className="modal-close mobile-sheet-close"
                    icon="x"
                    label="Закрыть"
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                  />
                ) : null}
              </header>
            )}
            <div className="mobile-sheet-body">{children}</div>
            {footer ? <footer className="mobile-sheet-footer">{footer}</footer> : null}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default MobileSheet;
