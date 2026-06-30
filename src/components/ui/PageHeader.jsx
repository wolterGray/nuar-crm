import clsx from "clsx";
import HintIcon from "../HintIcon.jsx";
import {PageNotificationsSlot} from "../PageNotifications.jsx";

export default function PageHeader({
  title,
  description,
  actions,
  headerActions,
  showNotifications = true,
  className,
}) {
  return (
    <header className={clsx("flex flex-col gap-4 pb-5 border-b border-border-soft mb-6 md:flex-row md:items-center md:justify-between md:min-h-[48px]", className)}>
      <div className="flex-1 min-w-0">
        <h1 className="m-0 text-text-main text-2xl font-bold tracking-tight flex items-center gap-2">
          {title}
          {description && <HintIcon>{description}</HintIcon>}
        </h1>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {headerActions}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
        {showNotifications && <PageNotificationsSlot />}
      </div>
    </header>
  );
}
