import clsx from "clsx";
import AppIcon from "./AppIcon.jsx";
import Button from "./Button.jsx";

export default function EmptyState({
  action,
  actionLabel,
  className,
  description,
  icon = "info",
  onAction,
  title = "Ничего нет",
}) {
  return (
    <div className={clsx("grid place-items-center gap-3 rounded-card border border-borderSoft bg-field p-6 text-center", className)}>
      <span className="grid h-10 w-10 place-items-center rounded-full bg-field text-textMuted">
        <AppIcon name={icon} size="lg" />
      </span>
      <div className="grid gap-1">
        <strong className="text-sm font-semibold text-textPrimary">{title}</strong>
        {description ? <span className="text-sm text-textMuted">{description}</span> : null}
      </div>
      {action || (actionLabel && onAction) ? (
        action ?? (
          <Button size="sm" variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        )
      ) : null}
    </div>
  );
}
