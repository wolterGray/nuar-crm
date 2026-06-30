import {forwardRef} from "react";
import clsx from "clsx";

const Input = forwardRef(({className, type = "text", ...props}, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={clsx(
        "w-full min-h-[40px] px-3 border border-border rounded-control text-text-main bg-field font-normal text-sm transition-all duration-150 placeholder:text-text-faint focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";

export default Input;
