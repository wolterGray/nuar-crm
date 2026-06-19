import {forwardRef} from "react";
import clsx from "clsx";

const Input = forwardRef(({className, ...props}, ref) => (
  <input
    className={clsx(
      "h-10 w-full rounded-xl border border-[var(--linear-border)] bg-[rgba(255,255,255,0.035)] px-3 text-sm text-[var(--linear-text)] shadow-none transition-colors",
      "placeholder:text-[var(--linear-dim)] focus:border-[rgba(139,124,255,0.42)] focus:outline-none focus:ring-2 focus:ring-[rgba(139,124,255,0.22)]",
      "disabled:cursor-not-allowed disabled:bg-[rgba(255,255,255,0.025)] disabled:text-[var(--linear-dim)]",
      className,
    )}
    ref={ref}
    {...props}
  />
));

Input.displayName = "Input";

export default Input;
