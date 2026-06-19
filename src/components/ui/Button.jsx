import {forwardRef} from "react";
import clsx from "clsx";

const variants = {
  primary:
    "border-[var(--button-primary-border,transparent)] bg-[var(--accent-color)] text-[var(--button-primary-text,#fff)] shadow-[var(--button-primary-shadow,0_12px_34px_rgba(139,124,255,0.22))] hover:bg-[var(--accent-hover)] focus-visible:ring-[var(--accent-color)] disabled:opacity-70",
  secondary:
    "border-[var(--linear-border)] bg-[rgba(255,255,255,0.035)] text-[var(--linear-text)] hover:bg-[rgba(255,255,255,0.065)] focus-visible:ring-[var(--accent-color)]",
  ghost:
    "border-transparent bg-transparent text-[var(--linear-muted)] hover:bg-[rgba(255,255,255,0.055)] hover:text-[var(--linear-text)] focus-visible:ring-[var(--accent-color)]",
  danger:
    "border-[rgba(244,63,94,0.24)] bg-[rgba(244,63,94,0.11)] text-red-200 hover:bg-[rgba(244,63,94,0.16)] focus-visible:ring-red-400",
};

const sizes = {
  sm: "h-9 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-3.5 text-sm",
  lg: "h-11 gap-2 px-4 text-sm",
  icon: "h-10 w-10 p-0",
};

const Button = forwardRef(
  ({className, variant = "secondary", size = "md", type = "button", ...props}, ref) => (
    <button
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-xl border font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "focus-visible:ring-offset-[var(--linear-bg)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70",
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
