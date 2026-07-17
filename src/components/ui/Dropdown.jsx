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
        "crm-dropdown-content absolute z-30 top-[calc(100%+var(--dropdown-offset))] right-0 min-w-[var(--dropdown-min-width)] overflow-hidden p-1 border border-border rounded-dropdown text-textPrimary bg-surface shadow-dropdown",
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
        "crm-dropdown-item flex w-full min-h-8 items-center px-2.5 border-0 rounded-sm text-textPrimary bg-transparent text-sm text-left hover:bg-field hover:text-textPrimary transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      type="button"
      {...props}
    />
  );
}
