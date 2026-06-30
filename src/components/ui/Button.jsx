import { forwardRef } from "react";
import clsx from "clsx";
import styles from "./Button.module.css";

const variants = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
  success: styles.success,
};

const Button = forwardRef(
  ({ className, variant = "secondary", type = "button", ...props }, ref) => (
    <button
      className={clsx(styles.button, variants[variant], className)}
      ref={ref}
      type={type}
      {...props}
    />
  )
);

Button.displayName = "Button";

export default Button;
