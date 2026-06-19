import clsx from "clsx";

const variants = {
  neutral: "border-[var(--linear-border)] bg-[rgba(255,255,255,0.055)] text-[var(--linear-muted)]",
  success: "border-[rgba(52,211,153,0.24)] bg-[rgba(52,211,153,0.10)] text-emerald-300",
  warning: "border-[rgba(251,191,36,0.24)] bg-[rgba(251,191,36,0.10)] text-amber-200",
  danger: "border-[rgba(244,63,94,0.24)] bg-[rgba(244,63,94,0.10)] text-rose-300",
};

export default function Badge({className, variant = "neutral", ...props}) {
  return (
    <span
      className={clsx(
        "inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium leading-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
