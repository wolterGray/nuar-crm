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
        "crm-dropdown-content absolute z-30 top-[calc(100%+6px)] right-0 min-w-[160px] overflow-hidden p-1 border border-border rounded-md text-text-main bg-surface shadow-lg",
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
        "crm-dropdown-item flex w-full min-h-[32px] items-center px-2.5 border-0 rounded-sm text-text-main bg-transparent text-sm text-left hover:bg-surface-soft hover:text-text-main transition-colors duration-100 cursor-pointer",
        className,
      )}
      type="button"
      {...props}
    />
  );
}
