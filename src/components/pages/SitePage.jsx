import {Save} from "lucide-react";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
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
  const {isMobile} = useBreakpoint();
  const pendingCount = siteBooking?.pendingRequests?.length ?? 0;
  const telegramEnabled = settings.siteBookingNotifyTelegramEnabled !== false;
  const whatsappEnabled = settings.siteBookingNotifyWhatsappEnabled !== false;
  const hasChatId = Boolean(String(settings.telegramChatId ?? "").trim());

  const saveBar = (
    <div className="settings-actions settings-save-bar settings-grid-full">
      <button className="submit-button" type="submit">
        <Save size={17} />
        Сохранить настройки
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <section className="site-page site-page-mobile">
        <PageHeader
          actions={
            <>
              <div className="site-page-summary">
                <article
                  className={`site-page-summary-card${
                    pendingCount > 0 ? " is-active" : ""
                  }`}>
                  <span>Заявки</span>
                  <strong>{pendingCount}</strong>
                </article>
                <article className="site-page-summary-card">
                  <span>Telegram</span>
                  <strong>{telegramEnabled ? "Вкл" : "Выкл"}</strong>
                </article>
                <article className="site-page-summary-card">
                  <span>WhatsApp</span>
                  <strong>{whatsappEnabled ? "Вкл" : "Выкл"}</strong>
                </article>
                <article className="site-page-summary-card">
                  <span>Chat ID</span>
                  <strong>{hasChatId ? "Есть" : "Нет"}</strong>
                </article>
              </div>
              <SiteAdminPanel compact embeddedMobile />
            </>
          }
          description={
            pendingCount > 0
              ? `${pendingCount} заявок ждут обработки`
              : "CMS nuarr.pl и заявки с сайта"
          }
          title="Сайт"
        />

        <form className="site-page-form settings-form" onSubmit={onSubmit}>
          <div className="site-scroll">
            <section className="site-mobile-section panel settings-panel">
              <SiteBookingNotifySettings settings={settings} />
            </section>

            {siteBooking ? (
              <SiteBookingPanel
                applyingRequestId={siteBooking.applyingRequestId}
                isMobile
                loadError={siteBooking.loadError}
                loading={siteBooking.loading}
                pendingRequests={siteBooking.pendingRequests}
                pushNotification={pushNotification}
                onApply={siteBooking.applyRequest}
                onRefresh={siteBooking.refreshPendingRequests}
                onReject={siteBooking.rejectRequest}
              />
            ) : null}
          </div>

          {saveBar}
        </form>
      </section>
    );
  }

  return (
    <section className="settings-page site-page">
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
            applyingRequestId={siteBooking.applyingRequestId}
            loadError={siteBooking.loadError}
            loading={siteBooking.loading}
            pendingRequests={siteBooking.pendingRequests}
            pushNotification={pushNotification}
            onApply={siteBooking.applyRequest}
            onRefresh={siteBooking.refreshPendingRequests}
            onReject={siteBooking.rejectRequest}
          />
        ) : null}

        {saveBar}
      </form>
    </section>
  );
}

export default SitePage;
