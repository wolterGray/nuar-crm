import clsx from "clsx";
import AppIcon from "./AppIcon.jsx";

export default function LoadingState({className, label = "Загрузка"}) {
  return (
    <div className={clsx("flex min-h-24 items-center justify-center gap-2 text-sm font-medium text-textMuted", className)} role="status">
      <AppIcon name="loader" size="md" spin />
      <span>{label}</span>
    </div>
  );
}
