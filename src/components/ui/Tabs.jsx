import clsx from "clsx";

export function Tabs({className, ...props}) {
  return <div className={clsx("grid gap-3", className)} {...props} />;
}

export function TabsList({className, ...props}) {
  return (
    <div
      className={clsx(
        "inline-flex rounded-md border border-neutral-200 bg-neutral-100 p-1",
        className,
      )}
      role="tablist"
      {...props}
    />
  );
}

export function TabsTrigger({active, className, ...props}) {
  return (
    <button
      className={clsx(
        "h-8 rounded-sm px-3 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950",
        active && "bg-white text-neutral-950 shadow-sm",
        className,
      )}
      role="tab"
      type="button"
      {...props}
    />
  );
}

export function TabsContent({className, ...props}) {
  return <div className={clsx("min-w-0", className)} role="tabpanel" {...props} />;
}
