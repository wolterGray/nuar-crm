import clsx from "clsx";
import AppIcon from "./AppIcon.jsx";

export function Tabs({className, ...props}) {
  return (
    <div
      className={clsx(
        "grid w-full grid-flow-col auto-cols-fr overflow-hidden border-b border-borderSoft",
        className,
      )}
      role="tablist"
      {...props}
    />
  );
}

export function TabButton({
  active = false,
  badge,
  children,
  className,
  icon,
  ...props
}) {
  return (
    <button
      aria-selected={active}
      className={clsx(
        "relative flex min-h-12 items-center justify-center gap-2 border-0 bg-transparent px-3 text-sm font-semibold text-textMuted transition-colors hover:text-textPrimary",
        active && "text-textPrimary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary",
        className,
      )}
      role="tab"
      type="button"
      {...props}>
      {icon ? <AppIcon name={icon} size="sm" /> : null}
      <span className="min-w-0 truncate">{children}</span>
      {badge ? (
        <span className="grid min-h-5 min-w-5 place-items-center rounded-pill bg-primary px-1.5 text-[11px] font-bold text-primaryText">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
