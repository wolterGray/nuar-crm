import clsx from "clsx";

export default function Skeleton({className}) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "block animate-pulse rounded-md bg-white/[0.06]",
        className,
      )}
    />
  );
}
