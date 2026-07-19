import clsx from "clsx";

export function Dropdown({className, children, ...props}) {
  return (
    <div className={clsx("crm-dropdown relative inline-flex", className)} {...props}>
      {children}
    </div>
  );
}

export function DropdownContent({className, ...props}) {
  return (
    <div
      className={clsx(
        "crm-dropdown-content absolute z-30 top-[calc(100%+var(--dropdown-offset))] right-0 min-w-[var(--dropdown-min-width)] overflow-hidden p-1 border rounded-dropdown shadow-dropdown",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownItem({className, variant = "default", ...props}) {
  return (
    <button
      className={clsx(
        "crm-dropdown-item flex w-full min-h-8 items-center px-2.5 border-0 rounded-sm text-sm text-left transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        variant !== "default" && `crm-dropdown-item-${variant}`,
        className,
      )}
      type="button"
      {...props}
    />
  );
}
