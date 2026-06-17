import {LoaderCircle, Play, RefreshCw, Send, SendHorizonal} from "lucide-react";
import {useState} from "react";
import {SettingsPanelHeading} from "./HintIcon.jsx";
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
    const message =
      preview.trim() ||
      status.previewMessage?.trim() ||
      "NUAR CRM: test Telegram notification";

    setTesting(true);

    try {
      const result = await sendTelegramDigestTest({message});

      if (result?.result?.ok === false) {
        throw new Error(result.result.error || "Telegram API error");
      }

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
      <SettingsPanelHeading
        hint="Ежедневная сводка: записи, дни рождения, пакеты, сертификаты, выручка"
        icon={SendHorizonal}
        title="Telegram-дайджест"
      />

      <div className="booksy-sync-status">
        <strong>
          {status.configured
            ? "Telegram Bot подключён на сервере"
            : !status.telegramTokenConfigured
              ? "Нет TELEGRAM_BOT_TOKEN в Supabase Edge Functions → Secrets"
              : !status.telegramChatIdConfigured
                ? "Укажите Chat ID в блоке «Уведомления о заявках с сайта»"
                : "Telegram не настроен полностью"}
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
          <span>Ещё не отправлялся автоматически</span>
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
        Supabase → Project Settings → Edge Functions → Secrets: `TELEGRAM_BOT_TOKEN`,
        `TELEGRAM_CHAT_ID`, `CRM_OWNER_USER_ID`, `TELEGRAM_DIGEST_CRON_SECRET`.
        Chat ID можно указать в CRM в блоке «Уведомления о заявках с сайта».
      </p>
      <p className="field-hint">
        Автоотправка в 08:00 (Warsaw): GitHub → Settings → Secrets → Actions — обязательно
        `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` (из Supabase → Settings → API).
        `TELEGRAM_DIGEST_CRON_SECRET` опционален, если cron идёт через GitHub Actions.
        В Supabase Edge Functions → Secrets нужны `CRM_OWNER_USER_ID`, `TELEGRAM_BOT_TOKEN`
        и Chat ID. В CRM включите «Telegram-дайджест» и сохраните настройки в облако.
      </p>
    </section>
  );
}

export default TelegramDigestPanel;
