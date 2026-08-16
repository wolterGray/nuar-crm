import clsx from "clsx";

export default function Field({
  children,
  className,
  description,
  error,
  htmlFor,
  label,
  required = false,
}) {
  const helperText = error || description || "";
  const shouldRenderHelper = error !== undefined || Boolean(description);

  return (
    <label className={clsx("grid gap-1.5 text-sm text-textSecondary", className)} htmlFor={htmlFor}>
      {label ? (
        <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-textMuted">
          {label}
          {required ? <span className="text-primary">*</span> : null}
        </span>
      ) : null}
      {children}
      {shouldRenderHelper ? (
        <span
          aria-hidden={helperText ? undefined : true}
          className={clsx(
            "min-h-4 text-xs",
            error ? "font-medium text-accentError" : "text-textMuted",
          )}>
          {helperText || "\u00A0"}
        </span>
      ) : null}
    </label>
  );
}
