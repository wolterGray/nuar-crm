import {SendHorizonal} from "lucide-react";
import {useState} from "react";
import {SettingsPanelHeading} from "./HintIcon.jsx";
import {sendTelegramDigestTest} from "../utils/telegramDigestApi.js";
import {Button, Field, Textarea} from "./ui/index.js";

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
              ? "Нет TELEGRAM_BOT_TOKEN на backend"
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
        <Button
          disabled={status.loading}
          leftIcon="refresh"
          loading={status.loading}
          type="button"
          variant="secondary"
          onClick={() => onRefreshStatus?.()}>
          Обновить статус
        </Button>
        <Button leftIcon="eye" type="button" variant="secondary" onClick={handlePreview}>
          Предпросмотр
        </Button>
        <Button
          disabled={status.loading || !status.configured}
          leftIcon="message"
          type="button"
          variant="primary"
          onClick={() => onSend?.()}>
          Отправить сейчас
        </Button>
      </div>

      {preview ? (
        <Field label="Предпросмотр сообщения">
          <Textarea readOnly rows="12" value={preview} />
        </Field>
      ) : null}

      <Button
        disabled={testing || !status.configured}
        leftIcon="message"
        loading={testing}
        type="button"
        variant="secondary"
        onClick={handleTest}>
        Отправить тест в Telegram
      </Button>

      <p className="field-hint">
        На Hetzner в `backend/.env` добавьте `TELEGRAM_BOT_TOKEN` и
        `TELEGRAM_CHAT_ID`. Chat ID можно указать и в CRM в блоке
        «Уведомления о заявках с сайта».
      </p>
      <p className="field-hint">
        Для автоотправки в 08:00 (Warsaw) нужен серверный cron/PM2 job,
        который вызывает backend-эндпоинт дайджеста или отдельный worker.
        В CRM включите «Telegram-дайджест» и сохраните настройки.
      </p>
    </section>
  );
}

export default TelegramDigestPanel;
