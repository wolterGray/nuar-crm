import clsx from "clsx";

export function Table({className, ...props}) {
  return (
    <div
      className={clsx(
        "overflow-hidden border border-border rounded-md bg-surface shadow-layer",
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
        "border-b border-border text-text-muted bg-surface-soft text-xs font-semibold uppercase tracking-wider",
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
        "border-b border-border-soft transition-colors duration-150 hover:bg-surface-soft last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({className, as: Component = "span", ...props}) {
  return <Component className={clsx("min-w-0", className)} {...props} />;
}
