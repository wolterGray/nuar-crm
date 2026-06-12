import {PageNotificationsSlot} from "./PageNotifications.jsx";

export default function PageHeader({
  actions,
  children,
  className = "",
  description,
  headerActions,
  title,
}) {
  return (
    <div className={`page-header-unified ${className}`.trim()}>
      <div className="page-header-unified-top">
        <div className="page-header-unified-copy">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="page-header-unified-side">
          {headerActions}
          <PageNotificationsSlot />
        </div>
      </div>
      {actions ? <div className="page-header-unified-actions">{actions}</div> : null}
      {children}
    </div>
  );
}
