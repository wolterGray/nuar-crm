import clsx from "clsx";

export function Card({className, ...props}) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-[var(--linear-border)] bg-[var(--linear-panel)] shadow-[var(--soft-shadow)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({className, ...props}) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-4 border-b border-[var(--linear-border-soft)] px-5 py-4",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({className, ...props}) {
  return (
    <h2
      className={clsx(
        "text-base font-semibold leading-6 text-[var(--linear-text)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({className, ...props}) {
  return <div className={clsx("px-5 py-4", className)} {...props} />;
}
