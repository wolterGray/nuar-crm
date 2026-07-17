import clsx from "clsx";

export function Table({className, ...props}) {
  return (
    <div
      className={clsx(
        "overflow-hidden border border-border rounded-card bg-surface shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export function TableHeader({className, ...props}) {
  return (
    <div
      className={clsx(
        "border-b border-borderSoft text-textMuted bg-field text-xs font-semibold uppercase tracking-wider",
        className,
      )}
      {...props}
    />
  );
}

export function TableRow({className, ...props}) {
  return (
    <div
      className={clsx(
        "border-b border-borderSoft transition-colors duration-150 hover:bg-field last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({className, as: Component = "span", ...props}) {
  return <Component className={clsx("min-w-0", className)} {...props} />;
}
