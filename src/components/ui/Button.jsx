import {forwardRef} from "react";
import clsx from "clsx";

const variants = {
  primary:
    "border-transparent bg-neutral-950 text-white shadow-sm hover:bg-neutral-800 focus-visible:ring-neutral-950 disabled:bg-neutral-300",
  secondary:
    "border-neutral-200 bg-white text-neutral-900 shadow-sm hover:bg-neutral-50 focus-visible:ring-neutral-400",
  ghost:
    "border-transparent bg-transparent text-neutral-700 hover:bg-neutral-100 focus-visible:ring-neutral-300",
  danger:
    "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-300",
};

const sizes = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-9 gap-2 px-3.5 text-sm",
  lg: "h-10 gap-2 px-4 text-sm",
  icon: "h-9 w-9 p-0",
};

const Button = forwardRef(
  ({className, variant = "secondary", size = "md", type = "button", ...props}, ref) => (
    <button
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-md border font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70",
        variants[variant],
        sizes[size],
        className,
      )}
      ref={ref}
      type={type}
      {...props}
    />
  ),
);

Button.displayName = "Button";

export default Button;
