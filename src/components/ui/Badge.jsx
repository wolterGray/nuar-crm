import clsx from "clsx";

const variants = {
  neutral: "border-border text-textSecondary bg-white/5",
  info: "border-accentInfo/25 text-accentInfo bg-accentInfo/10",
  success: "crm-badge-success border-accentSuccess/25 text-accentSuccess bg-accentSuccess/10",
  warning: "crm-badge-warning border-accentWarning/25 text-accentWarning bg-accentWarning/10",
  error: "crm-badge-danger border-accentError/25 text-accentError bg-accentError/10",
  danger: "crm-badge-danger border-accentError/25 text-accentError bg-accentError/10",
  premium: "border-premium/30 text-premium bg-premium/10",
  disabled: "border-borderSoft text-textMuted bg-field",
};

export default function Badge({className, size = "md", variant = "neutral", ...props}) {
  return (
    <span
      className={clsx(
        "crm-badge inline-flex items-center border rounded-pill font-semibold leading-none whitespace-nowrap",
        size === "sm" ? "h-4 px-1.5 text-[10px]" : "h-5 px-2 text-[11px]",
        variants[variant] ?? variants.neutral,
        className,
      )}
      {...props}
    />
  );
}
