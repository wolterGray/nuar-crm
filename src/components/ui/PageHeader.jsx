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
    <header className={clsx("ui-page-header flex flex-col gap-3 pb-4 border-b border-border-soft mb-6 w-full", className)}>
      <div className="flex items-center justify-between gap-4 w-full min-h-[40px]">
        <div className="flex-1 min-w-0">
          <h1 className="m-0 text-text-main text-2xl font-bold tracking-tight flex items-center gap-2">
            {title}
            {description && <HintIcon>{description}</HintIcon>}
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerActions}
          {showNotifications && <PageNotificationsSlot />}
        </div>
      </div>
      {actions && <div className="flex items-center justify-end gap-2 flex-wrap w-full mt-0.5">{actions}</div>}
    </header>
  );
}
