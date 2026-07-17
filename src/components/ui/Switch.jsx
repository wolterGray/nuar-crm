import {forwardRef} from "react";
import clsx from "clsx";

const Switch = forwardRef(({className, ...props}, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={clsx(
      "h-6 w-11 cursor-pointer appearance-none rounded-pill border border-border bg-field transition before:block before:h-5 before:w-5 before:translate-x-0 before:rounded-full before:bg-textMuted before:transition checked:border-primary checked:bg-primary/25 checked:before:translate-x-5 checked:before:bg-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
    {...props}
  />
));

Switch.displayName = "Switch";

export default Switch;
