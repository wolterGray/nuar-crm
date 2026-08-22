import {useCallback, useEffect, useRef} from "react";
import {useModalScrollLock} from "../hooks/useModalScrollLock.js";
import IconButton from "./ui/IconButton.jsx";

const CLOSE_ANIMATION_MS = 220;

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
  const backdropRef = useRef(null);
  const closeTimerRef = useRef(null);
  const closingRef = useRef(false);
  useModalScrollLock(isOpen);

  const requestClose = useCallback(() => {
    if (!onClose || closingRef.current) return;

    closingRef.current = true;
    backdropRef.current?.classList.add("is-closing");
    closeTimerRef.current = window.setTimeout(() => {
      closingRef.current = false;
      onClose();
    }, CLOSE_ANIMATION_MS);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        requestClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, requestClose]);

  useEffect(() => () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={backdropRef}
      className="modal-backdrop mobile-sheet-backdrop mac-window-backdrop"
      role="presentation"
      onClick={requestClose}>
      <section
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={`mobile-sheet mac-window-surface ${fullscreen ? "mobile-sheet-fullscreen" : ""} ${className}`.trim()}
        role="dialog"
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
                    onClick={requestClose}
                  />
            ) : null}
          </header>
        )}
        <div className="mobile-sheet-body">{children}</div>
        {footer ? <footer className="mobile-sheet-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

export default MobileSheet;
