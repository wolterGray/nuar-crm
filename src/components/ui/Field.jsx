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
  return (
    <label className={clsx("grid gap-1.5 text-sm text-textSecondary", className)} htmlFor={htmlFor}>
      {label ? (
        <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-textMuted">
          {label}
          {required ? <span className="text-primary">*</span> : null}
        </span>
      ) : null}
      {children}
      {error ? (
        <span className="text-xs font-medium text-accentError">{error}</span>
      ) : description ? (
        <span className="text-xs text-textMuted">{description}</span>
      ) : null}
    </label>
  );
}
