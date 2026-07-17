import { forwardRef } from "react";
import clsx from "clsx";
import AppIcon from "./AppIcon.jsx";
import styles from "./Button.module.css";

const variants = {
  ghost: styles.ghost,
  link: styles.link,
  outline: styles.outline,
  primary: styles.primary,
  secondary: styles.secondary,
  subtle: styles.subtle,
  danger: styles.danger,
  success: styles.success,
};

const sizes = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
};

function renderIcon(icon, label) {
  if (!icon) return null;
  if (typeof icon === "string") return <AppIcon name={icon} size="sm" label={label} decorative={!label} />;
  return icon;
}

const Button = forwardRef(
  ({
    children,
    className,
    disabled,
    fullWidth = false,
    icon,
    isLoading = false,
    leftIcon,
    loading,
    loadingLabel = "Загрузка",
    rightIcon,
    size = "md",
    variant = "secondary",
    type = "button",
    ...props
  }, ref) => {
    const busy = loading || isLoading;
    const iconOnly = Boolean(icon && !children);

    return (
    <button
      aria-busy={busy || undefined}
      className={clsx(
        styles.button,
        variants[variant] ?? styles.secondary,
        sizes[size] ?? styles.md,
        fullWidth && styles.fullWidth,
        iconOnly && styles.iconOnly,
        busy && styles.loading,
        className,
      )}
      disabled={disabled || busy}
      ref={ref}
      type={type}
      {...props}>
      {busy ? renderIcon("loader", loadingLabel) : renderIcon(icon || leftIcon)}
      {children ? <span className={styles.content}>{children}</span> : null}
      {!busy ? renderIcon(rightIcon) : null}
    </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
