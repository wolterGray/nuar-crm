import clsx from "clsx";

export function Table({className, ...props}) {
  return (
    <div
      className={clsx(
        "overflow-hidden rounded-lg border border-neutral-200 bg-white",
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
        "border-b border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-500",
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
        "border-b border-neutral-100 transition-colors last:border-b-0 hover:bg-neutral-50",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({className, as: Component = "span", ...props}) {
  return <Component className={clsx("min-w-0", className)} {...props} />;
}
