import {forwardRef} from "react";
import clsx from "clsx";

const Select = forwardRef(({className, children, ...props}, ref) => {
  return (
    <select
      ref={ref}
      className={clsx(
        "w-full min-h-12 md:min-h-10 px-4 md:px-3 border border-border rounded-control text-textPrimary bg-field font-normal text-base md:text-sm transition-all duration-150 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed appearance-none",
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
