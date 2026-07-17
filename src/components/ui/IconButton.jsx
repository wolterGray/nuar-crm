import {forwardRef} from "react";
import clsx from "clsx";
import AppIcon from "./AppIcon.jsx";
import styles from "./IconButton.module.css";

const variants = {
  danger: styles.danger,
  ghost: styles.ghost,
  outline: styles.outline,
  primary: styles.primary,
  subtle: styles.subtle,
};

const sizes = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

const iconSizes = {
  sm: "sm",
  md: "md",
  lg: "lg",
};

const IconButton = forwardRef(
  ({
    className,
    disabled,
    icon = "more",
    iconClassName,
    label,
    loading = false,
    size = "md",
    type = "button",
    variant = "ghost",
    ...props
  }, ref) => (
    <button
      aria-busy={loading || undefined}
      aria-label={label}
      className={clsx(styles.button, variants[variant] ?? styles.ghost, sizes[size] ?? styles.md, className)}
      disabled={disabled || loading}
      ref={ref}
      title={label}
      type={type}
      {...props}>
      <AppIcon
        className={iconClassName}
        name={loading ? "loader" : icon}
        size={iconSizes[size] ?? "md"}
        spin={loading}
      />
    </button>
  ),
);

IconButton.displayName = "IconButton";

export default IconButton;
