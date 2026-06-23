import {CalendarPlus, Globe, LoaderCircle, MessageSquareText, RefreshCw, X} from "lucide-react";
import {useCallback, useEffect, useMemo, useState} from "react";
import {fetchOwnerNotifyStatus, testOwnerNotify} from "../utils/ownerNotifyApi.js";
import {formatSiteBookingInputDate} from "../utils/siteBooking.js";
import {buildSiteBookingFunnel} from "../utils/siteBookingFunnel.js";

const STALE_PENDING_HOURS = 2;

const formatCreatedAt = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
};

const isStalePendingRequest = (request, now) => {
  const createdAt = new Date(request?.created_at ?? request?.createdAt);

  if (Number.isNaN(createdAt.getTime())) {
    return true;
  }

  return now.getTime() - createdAt.getTime() >= STALE_PENDING_HOURS * 60 * 60 * 1000;
};

function SiteBookingPanel({
  applyingRequestId = "",
  isMobile = false,
  loadError,
  loading,
  pendingRequests = [],
  recentRequests = [],
  onApply,
  onRefresh,
  onReject,
  pushNotification,
}) {
  const [notifyStatus, setNotifyStatus] = useState({
    loading: false,
    ownerPhone: "",
    siteBookingNotifyTelegramEnabled: true,
    siteBookingNotifyWhatsappEnabled: true,
    smsConfigured: false,
    telegramChatId: "",
    telegramChatIdConfigured: false,
    telegramConfigured: false,
    telegramTokenConfigured: false,
    whatsappConfigured: false,
  });
  const [testingNotify, setTestingNotify] = useState(false);
  const [funnelNow] = useState(() => new Date());
  const funnel = useMemo(
    () =>
      buildSiteBookingFunnel({
        now: funnelNow,
        pendingStaleHours: STALE_PENDING_HOURS,
        requests: recentRequests.length ? recentRequests : pendingRequests,
      }),
    [funnelNow, pendingRequests, recentRequests],
  );

  const refreshNotifyStatus = useCallback(async () => {
    setNotifyStatus((current) => ({...current, loading: true}));

    try {
      const remote = await fetchOwnerNotifyStatus();
      setNotifyStatus({
        loading: false,
        ownerPhone: String(remote.ownerPhone ?? ""),
        siteBookingNotifyTelegramEnabled:
          remote.siteBookingNotifyTelegramEnabled !== false,
        siteBookingNotifyWhatsappEnabled:
          remote.siteBookingNotifyWhatsappEnabled !== false,
        smsConfigured: Boolean(remote.smsConfigured),
        telegramChatId: String(remote.telegramChatId ?? ""),
        telegramChatIdConfigured: Boolean(remote.telegramChatIdConfigured),
        telegramConfigured: Boolean(remote.telegramConfigured),
        telegramTokenConfigured: Boolean(remote.telegramTokenConfigured),
        whatsappConfigured: Boolean(remote.whatsappConfigured),
      });
    } catch (error) {
      setNotifyStatus((current) => ({...current, loading: false}));
      pushNotification?.({
        title: "Статус уведомлений недоступен",
        message:
          error?.message ||
          "Сохраните настройки в облако и задеплойте telegram-daily-digest",
      });
    }
  }, [pushNotification]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshNotifyStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshNotifyStatus]);

  const handleNotifyTest = async () => {
    setTestingNotify(true);

    try {
      const result = await testOwnerNotify();
      const telegramOk = result?.results?.telegram?.ok;
      const whatsappOk = result?.results?.whatsapp?.ok;
      const telegramError = result?.results?.telegram?.error;
      const whatsappError = result?.results?.whatsapp?.error;

      if (telegramOk || whatsappOk) {
        pushNotification?.({
          title: "Тест уведомления отправлен",
          message: [
            telegramOk ? "Telegram: ok" : null,
            whatsappOk ? "WhatsApp/SMS: ok" : null,
          ]
            .filter(Boolean)
            .join(" · "),
        });
      } else {
        pushNotification?.({
          title: "Уведомление не отправилось",
          message: [telegramError, whatsappError].filter(Boolean).join(" · ") ||
            "Проверьте secrets в Supabase и Chat ID в настройках CRM",
        });
      }

      await refreshNotifyStatus();
    } catch (error) {
      pushNotification?.({
        title: "Тест не выполнен",
        message: error?.message || "Не удалось вызвать edge function",
      });
    } finally {
      setTestingNotify(false);
    }
  };

  const telegramStatusMessage = notifyStatus.telegramConfigured
    ? "Telegram готов к уведомлениям"
    : !notifyStatus.telegramTokenConfigured
      ? "Нет TELEGRAM_BOT_TOKEN в Supabase → Project Settings → Edge Functions → Secrets"
      : !notifyStatus.telegramChatIdConfigured
        ? "Укажите Chat ID в блоке выше и сохраните настройки в облако"
        : "Telegram не готов — проверьте secrets и Chat ID";

  return (
    <section
      className={`panel site-booking-panel${
        isMobile ? " site-booking-panel-mobile site-mobile-section" : ""
      }`}>
      {!isMobile ? (
        <div className="settings-panel-heading">
          <Globe size={18} />
          <div>
            <h2>Заявки с сайта</h2>
            <p>Форма на nuarr.pl → Supabase → импорт в календарь CRM</p>
          </div>
        </div>
      ) : (
        <div className="site-mobile-section-head">
          <h3>Заявки с сайта</h3>
          <span className="site-mobile-section-meta">К обработке: {pendingRequests.length}</span>
        </div>
      )}

      <div className="booksy-sync-status">
        <strong>{telegramStatusMessage}</strong>
        <span>
          WhatsApp/SMS:{" "}
          {notifyStatus.whatsappConfigured || notifyStatus.smsConfigured
            ? "настроено"
            : "нужен WhatsApp API или SMSAPI + телефон владельца"}
        </span>
        {notifyStatus.telegramChatId ? (
          <small>Chat ID: {notifyStatus.telegramChatId}</small>
        ) : null}
        {!notifyStatus.telegramTokenConfigured ? (
          <small>
            Токен бота задаётся только в Supabase Secrets, не в CRM. Имя секрета:
            TELEGRAM_BOT_TOKEN
          </small>
        ) : null}
      </div>

      <div
        className={`settings-actions-row${
          isMobile ? " site-booking-toolbar-mobile" : ""
        }`}>
        <button
          className="secondary-button"
          disabled={loading}
          type="button"
          onClick={onRefresh}>
          <RefreshCw className={loading ? "spin" : ""} size={16} />
          Обновить заявки
        </button>
        <button
          className="secondary-button"
          disabled={notifyStatus.loading}
          type="button"
          onClick={refreshNotifyStatus}>
          {notifyStatus.loading ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <RefreshCw size={16} />
          )}
          Проверить Telegram
        </button>
        <button
          className="secondary-button"
          disabled={testingNotify}
          type="button"
          onClick={handleNotifyTest}>
          {testingNotify ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <MessageSquareText size={16} />
          )}
          Тест уведомления
        </button>
        {!isMobile ? (
          <span className="site-booking-counter">
            К обработке: <b>{pendingRequests.length}</b>
          </span>
        ) : null}
      </div>

      <div className="site-booking-funnel">
        <div className="site-booking-funnel-head">
          <div>
            <strong>Воронка заявок</strong>
            <span>
              Последние {funnel.total} · средняя реакция {funnel.averageResponseLabel}
            </span>
          </div>
          <b className={funnel.stalePendingCount > 0 ? "is-warning" : ""}>
            {funnel.stalePendingCount > 0
              ? `Зависли: ${funnel.stalePendingCount}`
              : "Без зависших"}
          </b>
        </div>
        <div className="site-booking-funnel-stages">
          {funnel.stages.map((stage) => (
            <article className={`site-booking-funnel-stage is-${stage.id}`} key={stage.id}>
              <span>{stage.label}</span>
              <strong>{stage.count}</strong>
            </article>
          ))}
        </div>
        {funnel.stalePendingRequests.length ? (
          <div className="site-booking-funnel-warning">
            <strong>Проверьте старые заявки</strong>
            <span>
              {funnel.stalePendingRequests
                .slice(0, 2)
                .map((request) => request.client_name || request.clientName || "Клиент")
                .join(", ")}
            </span>
          </div>
        ) : null}
      </div>

      {!isMobile ? (
        <p className="field-hint">
          Сначала укажите Chat ID и включите каналы в блоке «Уведомления о заявках с
          сайта» выше, нажмите «Сохранить настройки» внизу и дождитесь синхронизации с
          облаком. «К обработке» — заявки в CRM, не Telegram.
        </p>
      ) : null}

      {loadError ? <p className="field-error">{loadError}</p> : null}

      {pendingRequests.length === 0 && !loading ? (
        <p className="site-booking-empty">Новых заявок с сайта пока нет.</p>
      ) : (
        <div className="site-booking-list">
          {pendingRequests.map((request) => (
            <article
              className={`site-booking-card${
                isMobile ? " site-booking-mobile-card" : ""
              }${isStalePendingRequest(request, funnelNow) ? " is-stale" : ""}`}
              key={request.id}>
              <div className="site-booking-card-main">
                <strong>{request.client_name}</strong>
                {isStalePendingRequest(request, funnelNow) ? (
                  <small className="site-booking-stale-label">Ждёт больше 2 часов</small>
                ) : null}
                <span>
                  {formatSiteBookingInputDate(request.preferred_date)} ·{" "}
                  {String(request.preferred_time ?? "").slice(0, 5)}
                </span>
                <span>{request.service_name}</span>
                {request.created_at ? (
                  <small>Заявка: {formatCreatedAt(request.created_at)}</small>
                ) : null}
                {request.preferred_master ? (
                  <small>Мастер: {request.preferred_master}</small>
                ) : null}
                {request.client_phone ? <small>{request.client_phone}</small> : null}
                {request.note ? <small>{request.note}</small> : null}
              </div>
              <div className="site-booking-card-actions">
                <button
                  className="add-visit-button"
                  disabled={Boolean(applyingRequestId)}
                  type="button"
                  onClick={() => onApply?.(request)}>
                  {applyingRequestId === request.id ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <CalendarPlus size={15} />
                  )}
                  {applyingRequestId === request.id ? "Добавляем..." : "В календарь"}
                </button>
                <button
                  aria-label="Отклонить"
                  className="secondary-button"
                  type="button"
                  onClick={() => onReject?.(request)}>
                  <X size={15} />
                  {isMobile ? "Отклонить" : null}
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
