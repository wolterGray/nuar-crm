import {PageNotificationsSlot} from "./PageNotifications.jsx";
import HintIcon from "./HintIcon.jsx";

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
          <h2>
            {title}
            {description ? <HintIcon>{description}</HintIcon> : null}
          </h2>
        </div>
        <div className="page-header-unified-trailing">
          {headerActions ? (
            <div className="page-header-unified-side">{headerActions}</div>
          ) : null}
          <PageNotificationsSlot />
        </div>
      </div>
      {actions ? <div className="page-header-unified-actions">{actions}</div> : null}
      {children}
    </div>
  );
}
