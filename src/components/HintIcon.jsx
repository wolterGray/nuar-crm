import {HelpCircle} from "lucide-react";
import {useCallback, useEffect, useId, useRef, useState} from "react";
import {createPortal} from "react-dom";

const TOOLTIP_MAX_WIDTH = 320;
const VIEWPORT_MARGIN = 12;

function HintIcon({children, className = ""}) {
  const text = String(children ?? "").trim();
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({
    left: 0,
    placement: "top",
    top: 0,
    width: TOOLTIP_MAX_WIDTH,
  });
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(TOOLTIP_MAX_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const halfWidth = width / 2;
    let left = rect.left + rect.width / 2;
    left = Math.max(
      VIEWPORT_MARGIN + halfWidth,
      Math.min(window.innerWidth - VIEWPORT_MARGIN - halfWidth, left),
    );

    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const placement = spaceAbove >= 96 || spaceAbove >= spaceBelow ? "top" : "bottom";
    const top =
      placement === "top" ? rect.top - VIEWPORT_MARGIN : rect.bottom + VIEWPORT_MARGIN;

    setCoords({left, placement, top, width});
  }, []);

  const show = useCallback(() => {
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    updatePosition();

    const handleReposition = () => updatePosition();

    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);

    return () => {
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, updatePosition]);

  if (!text) {
    return null;
  }

  return (
    <>
      <span
        className={`hint-icon-wrap ${className}`.trim()}
        onMouseEnter={show}
        onMouseLeave={hide}>
        <span
          ref={triggerRef}
          aria-describedby={open ? tooltipId : undefined}
          aria-label={text}
          className="hint-icon"
          role="img"
          tabIndex={0}
          onBlur={hide}
          onFocus={show}>
          <HelpCircle aria-hidden size={14} strokeWidth={2} />
        </span>
      </span>
      {open
        ? createPortal(
            <span
              className={`hint-tooltip hint-tooltip-portal is-${coords.placement}`}
              id={tooltipId}
              role="tooltip"
              style={{
                left: `${coords.left}px`,
                top: `${coords.top}px`,
                width: `${coords.width}px`,
              }}>
              {text}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

export function FieldLabel({children, hint}) {
  return (
    <span className="labeled-hint-row">
      {children}
      {hint ? <HintIcon>{hint}</HintIcon> : null}
    </span>
  );
}

export function SettingsPanelHeading({hint, icon: Icon, title}) {
  return (
    <div className="settings-panel-heading">
      <Icon size={18} />
      <div>
        <h2>
          {title}
          {hint ? <HintIcon>{hint}</HintIcon> : null}
        </h2>
      </div>
    </div>
  );
}

export default HintIcon;
