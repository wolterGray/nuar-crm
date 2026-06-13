import {Save} from "lucide-react";
import PageHeader from "../PageHeader.jsx";
import SiteAdminPanel from "../SiteAdminPanel.jsx";
import SiteBookingNotifySettings from "../SiteBookingNotifySettings.jsx";
import SiteBookingPanel from "../SiteBookingPanel.jsx";

function SitePage({
  settings,
  siteBooking = null,
  pushNotification,
  onSubmit,
}) {
  return (
    <section className="settings-page">
      <PageHeader
        description="CMS nuarr.pl, заявки с сайта и уведомления владельцу о новых бронях"
        title="Сайт NUAR"
      />

      <form className="settings-form settings-grid" onSubmit={onSubmit}>
        <section className="panel settings-panel settings-grid-full">
          <SiteAdminPanel compact />
        </section>

        <section className="panel settings-panel settings-grid-full">
          <SiteBookingNotifySettings settings={settings} />
        </section>

        {siteBooking ? (
          <SiteBookingPanel
            loadError={siteBooking.loadError}
            loading={siteBooking.loading}
            pendingRequests={siteBooking.pendingRequests}
            pushNotification={pushNotification}
            onApply={siteBooking.applyRequest}
            onRefresh={siteBooking.refreshPendingRequests}
            onReject={siteBooking.rejectRequest}
          />
        ) : null}

        <div className="settings-actions settings-save-bar settings-grid-full">
          <button className="submit-button" type="submit">
            <Save size={17} />
            Сохранить настройки
          </button>
        </div>
      </form>
    </section>
  );
}

export default SitePage;
