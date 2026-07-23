import clsx from "clsx";
import HintIcon from "../HintIcon.jsx";
import {PageNotificationsSlot} from "../PageNotifications.jsx";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";

export default function PageHeader({
  title,
  description,
  actions,
  headerActions,
  showNotifications = true,
  className,
}) {
  const {isMobile} = useBreakpoint();

  if (isMobile) {
    return (
      <header className={clsx("mobile-ui-page-header", className)}>
        <div className="mobile-ui-page-header-row">
          <div className="mobile-ui-page-header-copy">
            <h1 className="mobile-ui-page-header-title">
              {title}
              {description && <HintIcon>{description}</HintIcon>}
            </h1>
          </div>
          <div className="mobile-ui-page-header-trailing">
            {headerActions}
            {showNotifications && <PageNotificationsSlot />}
          </div>
        </div>
        {actions && <div className="mobile-ui-page-header-actions">{actions}</div>}
      </header>
    );
  }

  return (
    <header className={clsx("ui-page-header flex flex-col gap-3 pb-4 border-b border-border-soft mb-6 w-full", className)}>
      <div className="ui-page-header-row flex items-center justify-between gap-4 w-full min-h-[40px]">
        <div className="ui-page-header-copy flex-1 min-w-0">
          <h1 className="ui-page-header-title m-0 text-text-main text-2xl font-bold tracking-tight flex items-center gap-2">
            {title}
            {description && <HintIcon>{description}</HintIcon>}
          </h1>
        </div>
        <div className="ui-page-header-trailing flex items-center gap-2 shrink-0">
          {headerActions}
          {showNotifications && <PageNotificationsSlot />}
        </div>
      </div>
      {actions && <div className="ui-page-header-actions flex items-center justify-end gap-2 flex-wrap w-full mt-0.5">{actions}</div>}
    </header>
  );
}
