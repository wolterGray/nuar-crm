import clsx from "clsx";

const variants = {
  neutral: "border-neutral-200 bg-neutral-100 text-neutral-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
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
