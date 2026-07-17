import clsx from "clsx";

export default function SectionHeader({actions, className, description, title}) {
  return (
    <div className={clsx("flex min-w-0 items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="m-0 text-base font-semibold text-textPrimary">{title}</h2>
        {description ? <p className="mt-1 text-sm text-textMuted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
