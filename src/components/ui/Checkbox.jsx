import {forwardRef} from "react";
import clsx from "clsx";

const Checkbox = forwardRef(({className, ...props}, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={clsx(
      "h-4 w-4 rounded-sm border border-border bg-field text-primary accent-primary transition focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
    {...props}
  />
));

Checkbox.displayName = "Checkbox";

export default Checkbox;
