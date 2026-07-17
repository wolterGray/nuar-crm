import {useEffect} from "react";
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

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal-backdrop mobile-sheet-backdrop"
      role="presentation"
      onClick={onClose}>
      <section
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={`mobile-sheet ${fullscreen ? "mobile-sheet-fullscreen" : ""} ${className}`.trim()}
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
                onClick={onClose}
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
