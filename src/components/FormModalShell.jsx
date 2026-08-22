import {useCallback, useEffect, useLayoutEffect, useRef} from "react";
import {useBreakpoint} from "../hooks/useBreakpoint.js";
import MobileSheet from "./MobileSheet.jsx";
import IconButton from "./ui/IconButton.jsx";

const CLOSE_ANIMATION_MS = 220;

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
  const backdropRef = useRef(null);
  const closeTimerRef = useRef(null);
  const closingRef = useRef(false);
  const dialogRef = useRef(null);

  const requestClose = useCallback(() => {
    if (!onClose || closingRef.current) return;

    closingRef.current = true;
    backdropRef.current?.classList.add("is-closing");
    closeTimerRef.current = window.setTimeout(() => {
      closingRef.current = false;
      onClose();
    }, CLOSE_ANIMATION_MS);
  }, [onClose]);

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

  useEffect(() => () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);

  if (!isOpen) {
    return null;
  }

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
    <div
      ref={backdropRef}
      className={`modal-backdrop mac-window-backdrop ${backdropClassName}`.trim()}
      role="presentation">
      <section
        ref={dialogRef}
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={`${className} mac-window-surface`.trim()}
        role="dialog">
        <div className="modal-header">
          <h2 className="crm-title" id={labelledBy}>{title}</h2>
          <IconButton
            className="modal-close"
            icon="x"
            label="Закрыть форму"
            size="sm"
            type="button"
            variant="ghost"
            onClick={requestClose}
          />
        </div>
        {children}
      </section>
    </div>
  );
}

export default FormModalShell;
