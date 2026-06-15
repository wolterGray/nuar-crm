import {X} from "lucide-react";
import {useBreakpoint} from "../hooks/useBreakpoint.js";
import MobileSheet from "./MobileSheet.jsx";

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
      className={`modal-backdrop ${backdropClassName}`.trim()}
      role="presentation">
      <section
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={className}
        role="dialog">
        <div className="modal-header">
          <h2 id={labelledBy}>{title}</h2>
          <button
            aria-label="Закрыть форму"
            className="modal-close"
            type="button"
            onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default FormModalShell;
