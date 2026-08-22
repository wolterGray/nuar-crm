import {useLayoutEffect, useRef} from "react";
import {AnimatePresence, motion, useReducedMotion} from "framer-motion";
import {useBreakpoint} from "../hooks/useBreakpoint.js";
import MobileSheet from "./MobileSheet.jsx";
import IconButton from "./ui/IconButton.jsx";

function FormModalShell({
  backdropClassName = "",
  children,
  className = "employee-modal",
  fullscreen,
  isOpen,
  labelledBy,
  onClose,
  title,
}) {
  const {isMobile} = useBreakpoint();
  const shouldReduceMotion = useReducedMotion();
  const dialogRef = useRef(null);

  useLayoutEffect(() => {
    if (!isOpen || !dialogRef.current) {
      return undefined;
    }

    const resetScroll = () => {
      const scrollContainers = [
        dialogRef.current,
        ...dialogRef.current.querySelectorAll("*"),
      ];

      scrollContainers.forEach((element) => {
        if ("scrollTop" in element) {
          element.scrollTop = 0;
        }
      });
    };

    resetScroll();
    const frameId = window.requestAnimationFrame(resetScroll);
    return () => window.cancelAnimationFrame(frameId);
  }, [isOpen, title]);

  if (isMobile) {
    return (
      <MobileSheet
        className={className}
        fullscreen={fullscreen ?? true}
        isOpen
        labelledBy={labelledBy}
        title={title}
        onClose={onClose}>
        {children}
      </MobileSheet>
    );
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{opacity: 1}}
          className={`modal-backdrop ${backdropClassName}`.trim()}
          exit={{opacity: 0}}
          initial={{opacity: 0}}
          role="presentation"
          transition={{duration: shouldReduceMotion ? 0.08 : 0.18, ease: "easeOut"}}
        >
          <motion.section
            ref={dialogRef}
            animate={shouldReduceMotion ? {opacity: 1} : {opacity: 1, scale: 1, y: 0}}
            aria-labelledby={labelledBy}
            aria-modal="true"
            className={className}
            exit={shouldReduceMotion ? {opacity: 0} : {opacity: 0, scale: 0.96, y: 10}}
            initial={shouldReduceMotion ? {opacity: 0} : {opacity: 0, scale: 0.94, y: 18}}
            role="dialog"
            transition={{
              damping: 32,
              duration: shouldReduceMotion ? 0.08 : undefined,
              mass: 0.85,
              stiffness: 430,
              type: "spring",
            }}
          >
            <div className="modal-header">
              <h2 className="crm-title" id={labelledBy}>{title}</h2>
              <IconButton
                className="modal-close"
                icon="x"
                label="Закрыть форму"
                size="sm"
                type="button"
                variant="ghost"
                onClick={onClose}
              />
            </div>
            {children}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default FormModalShell;
