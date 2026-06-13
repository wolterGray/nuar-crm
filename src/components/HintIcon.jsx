import {HelpCircle} from "lucide-react";

function HintIcon({children, className = ""}) {
  const text = String(children ?? "").trim();

  if (!text) {
    return null;
  }

  return (
    <span className={`hint-icon-wrap ${className}`.trim()}>
      <span aria-label={text} className="hint-icon" role="img" tabIndex={0}>
        <HelpCircle aria-hidden size={14} strokeWidth={2} />
      </span>
      <span className="hint-tooltip" role="tooltip">
        {text}
      </span>
    </span>
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
