import {CalendarPlus, Globe, LoaderCircle, MessageSquareText, RefreshCw, X} from "lucide-react";
import {useCallback, useEffect, useState} from "react";
import {fetchOwnerNotifyStatus, testOwnerNotify} from "../utils/ownerNotifyApi.js";
import {formatSiteBookingInputDate} from "../utils/siteBooking.js";

function SiteBookingPanel({
  applyingRequestId = "",
  loadError,
  loading,
  pendingRequests = [],
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
    <section className="panel site-booking-panel">
      <div className="settings-panel-heading">
        <Globe size={18} />
        <div>
          <h2>Заявки с сайта</h2>
          <p>Форма на nuarr.pl → Supabase → импорт в календарь CRM</p>
        </div>
      </div>

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

      <div className="settings-actions-row">
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
        <span className="site-booking-counter">
          К обработке: <b>{pendingRequests.length}</b>
        </span>
      </div>

      <p className="field-hint">
        Сначала укажите Chat ID и включите каналы в блоке «Уведомления о заявках с
        сайта» выше, нажмите «Сохранить настройки» внизу и дождитесь синхронизации с
        облаком. «К обработке» — заявки в CRM, не Telegram.
      </p>

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
