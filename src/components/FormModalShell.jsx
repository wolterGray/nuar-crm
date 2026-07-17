import {useLayoutEffect, useRef} from "react";
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
        ref={dialogRef}
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={className}
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
            onClick={onClose}
          />
        </div>
        {children}
      </section>
    </div>
  );
}

export default FormModalShell;
