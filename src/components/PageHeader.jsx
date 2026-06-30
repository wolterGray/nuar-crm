import {ChevronDown} from "lucide-react";
import {PageNotificationsSlot} from "./PageNotifications.jsx";
import HintIcon from "./HintIcon.jsx";

export default function PageHeader({
  actions,
  children,
  className = "",
  collapsedMeta,
  collapsible = false,
  defaultExpanded = true,
  description,
  headerActions,
  showNotifications = true,
  title,
}) {
  const notifications = showNotifications ? <PageNotificationsSlot /> : null;

  const headerBody = (
    <>
      {!collapsible ? (
        <div className="page-header-unified-top">
          <div className="page-header-unified-copy">
            <h2 className="crm-title page-title">
              {title}
              {description ? <HintIcon>{description}</HintIcon> : null}
            </h2>
          </div>
          <div className="page-header-unified-trailing">
            {headerActions ? (
              <div className="page-header-unified-side">{headerActions}</div>
            ) : null}
            {notifications}
          </div>
        </div>
      ) : null}
      {actions ? <div className="page-header-unified-actions page-actions">{actions}</div> : null}
      {children}
    </>
  );

  if (!collapsible) {
    return (
      <div className={`page-header-unified ${className}`.trim()}>
        {headerBody}
      </div>
    );
  }

  return (
    <details
      className={`page-header-collapsible ${className}`.trim()}
      open={defaultExpanded || undefined}>
      <summary className="page-header-collapsible-summary">
        <div className="page-header-collapsible-summary-main">
          <span className="page-header-collapsible-title crm-title">{title}</span>
          {description ? <HintIcon>{description}</HintIcon> : null}
          {collapsedMeta ? (
            <span className="page-header-collapsible-meta">{collapsedMeta}</span>
          ) : null}
        </div>
        <div className="page-header-collapsible-summary-trailing">
          {headerActions ? (
            <div
              className="page-header-unified-side page-header-collapsible-side"
              onClick={(event) => event.stopPropagation()}>
              {headerActions}
            </div>
          ) : null}
          <div className="page-header-collapsible-actions">
            <span aria-hidden="true" className="page-header-collapsible-toggle">
              <ChevronDown className="page-header-collapsible-chevron" size={18} />
            </span>
            {showNotifications ? (
              <div
                className="page-header-collapsible-notifications"
                onClick={(event) => event.stopPropagation()}>
                <PageNotificationsSlot />
              </div>
            ) : null}
          </div>
        </div>
      </summary>
      <div className="page-header-collapsible-body page-header-unified">
        {headerBody}
      </div>
    </details>
  );
}
