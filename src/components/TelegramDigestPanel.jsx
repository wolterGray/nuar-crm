import {LoaderCircle, Play, RefreshCw, Send, SendHorizonal} from "lucide-react";
import {useState} from "react";
import {sendTelegramDigestTest} from "../utils/telegramDigestApi.js";

function TelegramDigestPanel({
  onPreview,
  onRefreshStatus,
  onSend,
  pushNotification,
  status,
}) {
  const [preview, setPreview] = useState(status.previewMessage || "");
  const [testing, setTesting] = useState(false);

  const handlePreview = async () => {
    const message = await onPreview?.();
    setPreview(String(message ?? ""));
  };

  const handleTest = async () => {
    const message = preview.trim() || status.previewMessage?.trim();

    if (!message) {
      pushNotification?.({
        title: "Нет текста дайджеста",
        message: "Сначала откройте предпросмотр",
      });
      return;
    }

    setTesting(true);

    try {
      await sendTelegramDigestTest({message});
      pushNotification?.({
        title: "Тестовое сообщение отправлено",
        message: "Проверьте Telegram-чат",
      });
    } catch (error) {
      pushNotification?.({
        title: "Telegram-тест не выполнен",
        message: error?.message || "Проверьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="panel settings-panel booksy-sync-panel">
      <div className="settings-panel-heading">
        <SendHorizonal size={18} />
        <div>
          <h2>Telegram-дайджест</h2>
          <p>Ежедневная сводка: записи, дни рождения, пакеты, сертификаты, выручка</p>
        </div>
      </div>

      <div className="booksy-sync-status">
        <strong>
          {status.configured
            ? "Telegram Bot подключён на сервере"
            : "Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в Supabase"}
        </strong>
        {status.lastRunAt ? (
          <small>
            Последняя отправка:{" "}
            {new Date(status.lastRunAt).toLocaleString("ru-RU", {
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              month: "2-digit",
            })}
          </small>
        ) : (
          <span>Ещё не отправлялся</span>
        )}
      </div>

      <div className="settings-actions-row">
        <button
          className="secondary-button"
          disabled={status.loading}
          type="button"
          onClick={() => onRefreshStatus?.()}>
          {status.loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
          Обновить статус
        </button>
        <button className="secondary-button" type="button" onClick={handlePreview}>
          <Play size={16} />
          Предпросмотр
        </button>
        <button
          className="add-visit-button"
          disabled={status.loading || !status.configured}
          type="button"
          onClick={() => onSend?.()}>
          <Send size={16} />
          Отправить сейчас
        </button>
      </div>

      {preview ? (
        <label>
          Предпросмотр сообщения
          <textarea readOnly rows="12" value={preview} />
        </label>
      ) : null}

      <button
        className="secondary-button"
        disabled={testing || !status.configured}
        type="button"
        onClick={handleTest}>
        {testing ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
        Отправить тест в Telegram
      </button>

      <p className="field-hint">
        В Supabase → Edge Functions → Secrets добавьте `TELEGRAM_BOT_TOKEN`,
        `TELEGRAM_CHAT_ID`, `CRM_OWNER_USER_ID` и `TELEGRAM_DIGEST_CRON_SECRET`.
        Cron раз в час проверит время из настроек и отправит дайджест один раз в
        день.
      </p>
    </section>
  );
}

export default TelegramDigestPanel;
