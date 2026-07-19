import clsx from "clsx";

const variants = {
  neutral: "crm-badge-neutral",
  info: "crm-badge-info",
  success: "crm-badge-success",
  warning: "crm-badge-warning",
  error: "crm-badge-danger",
  danger: "crm-badge-danger",
  premium: "crm-badge-premium",
  disabled: "crm-badge-disabled",
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
