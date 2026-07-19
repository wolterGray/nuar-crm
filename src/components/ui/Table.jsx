import clsx from "clsx";

export function Table({className, ...props}) {
  return (
    <div
      className={clsx(
        "crm-table overflow-hidden border rounded-card shadow-none",
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
        "crm-table-header border-b text-xs font-semibold uppercase tracking-wider",
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
        "crm-table-row border-b transition-colors duration-150 last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({className, as: Component = "span", ...props}) {
  return <Component className={clsx("min-w-0", className)} {...props} />;
}
