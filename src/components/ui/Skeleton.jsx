import clsx from "clsx";

export default function Skeleton({className}) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "crm-skeleton block animate-pulse rounded-md",
        className,
      )}
    />
  );
}
