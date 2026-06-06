import clsx from "clsx";

export function Dropdown({className, children, ...props}) {
  return (
    <div className={clsx("relative inline-flex", className)} {...props}>
      {children}
    </div>
  );
}

export function DropdownContent({className, ...props}) {
  return (
    <div
      className={clsx(
        "absolute right-0 top-[calc(100%+6px)] z-30 min-w-40 overflow-hidden rounded-md border border-neutral-200 bg-white p-1 shadow-lg",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownItem({className, ...props}) {
  return (
    <button
      className={clsx(
        "flex h-8 w-full items-center rounded-sm px-2.5 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-950",
        className,
      )}
      type="button"
      {...props}
    />
  );
}
