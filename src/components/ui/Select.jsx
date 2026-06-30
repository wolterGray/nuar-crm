import {forwardRef} from "react";
import clsx from "clsx";

const Select = forwardRef(({className, children, ...props}, ref) => {
  return (
    <select
      ref={ref}
      className={clsx(
        "w-full min-h-[40px] px-3 border border-border rounded-control text-text-main bg-field font-normal text-sm transition-all duration-150 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed appearance-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

Select.displayName = "Select";

export default Select;
