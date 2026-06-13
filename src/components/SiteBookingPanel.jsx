import {CalendarPlus, Globe, RefreshCw, X} from "lucide-react";
import {formatSiteBookingInputDate} from "../utils/siteBooking.js";

function SiteBookingPanel({
  loadError,
  loading,
  pendingRequests = [],
  onApply,
  onRefresh,
  onReject,
}) {
  return (
    <section className="panel site-booking-panel">
      <div className="settings-panel-heading">
        <Globe size={18} />
        <div>
          <h2>Заявки с сайта</h2>
          <p>Форма на nuarr.pl → Supabase → импорт в календарь CRM</p>
        </div>
      </div>

      <div className="settings-actions-row">
        <button
          className="secondary-button"
          disabled={loading}
          type="button"
          onClick={onRefresh}>
          <RefreshCw className={loading ? "spin" : ""} size={16} />
          Обновить
        </button>
        <span className="site-booking-counter">
          К обработке: <b>{pendingRequests.length}</b>
        </span>
      </div>

      {loadError ? <p className="field-error">{loadError}</p> : null}

      {pendingRequests.length === 0 && !loading ? (
        <p className="site-booking-empty">Новых заявок с сайта пока нет.</p>
      ) : (
        <div className="site-booking-list">
          {pendingRequests.map((request) => (
            <article className="site-booking-card" key={request.id}>
              <div className="site-booking-card-main">
                <strong>{request.client_name}</strong>
                <span>
                  {formatSiteBookingInputDate(request.preferred_date)} ·{" "}
                  {String(request.preferred_time ?? "").slice(0, 5)}
                </span>
                <span>{request.service_name}</span>
                {request.preferred_master ? (
                  <small>Мастер: {request.preferred_master}</small>
                ) : null}
                {request.client_phone ? <small>{request.client_phone}</small> : null}
                {request.note ? <small>{request.note}</small> : null}
              </div>
              <div className="site-booking-card-actions">
                <button
                  className="add-visit-button"
                  type="button"
                  onClick={() => onApply?.(request)}>
                  <CalendarPlus size={15} />
                  В календарь
                </button>
                <button
                  aria-label="Отклонить"
                  className="secondary-button"
                  type="button"
                  onClick={() => onReject?.(request)}>
                  <X size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default SiteBookingPanel;
