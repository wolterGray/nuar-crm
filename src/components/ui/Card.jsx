import clsx from "clsx";

export function Card({className, ...props}) {
  return (
    <section
      className={clsx(
        "rounded-lg border border-neutral-200 bg-white shadow-sm",
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
        "flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4",
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
        "text-base font-semibold leading-6 text-neutral-950",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({className, ...props}) {
  return <div className={clsx("px-5 py-4", className)} {...props} />;
}
