import {forwardRef} from "react";
import clsx from "clsx";

const Input = forwardRef(({className, ...props}, ref) => (
  <input
    className={clsx(
      "h-9 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950 shadow-sm transition-colors",
      "placeholder:text-neutral-400 focus:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-200",
      "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500",
      className,
    )}
    ref={ref}
    {...props}
  />
));

Input.displayName = "Input";

export default Input;
