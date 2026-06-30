import clsx from "clsx";

const variants = {
  neutral: "border-border text-text-muted bg-white/5",
  success: "crm-badge-success border-emerald-500/20 text-emerald-400 bg-emerald-500/10",
  warning: "crm-badge-warning border-amber-500/20 text-amber-400 bg-amber-500/10",
  danger: "crm-badge-danger border-rose-500/20 text-rose-400 bg-rose-500/10",
};

export default function Badge({className, variant = "neutral", ...props}) {
  return (
    <span
      className={clsx(
        "crm-badge inline-flex h-5 items-center px-2 border rounded-full text-[11px] font-medium leading-none whitespace-nowrap",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
