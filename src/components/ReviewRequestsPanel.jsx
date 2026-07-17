import {useState} from "react";
import {SettingsPanelHeading} from "./HintIcon.jsx";
import {defaultReviewRequestTemplate} from "../utils/reviewRequests.js";
import {sendReviewRequestTest} from "../utils/reviewRequestsApi.js";
import {AppIcon, Button, Field, Input, Textarea} from "./ui/index.js";

function ReviewRequestsPanel({
  onPreview,
  onProcess,
  onRefreshStatus,
  pushNotification,
  status,
}) {
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState(
    defaultReviewRequestTemplate.replace("{name}", "Anna").replace(
      "{reviewUrl}",
      "https://g.page/nuar/review",
    ),
  );
  const [testing, setTesting] = useState(false);
  const [preview, setPreview] = useState([]);

  const handlePreview = async () => {
    const due = await onPreview?.();
    setPreview(Array.isArray(due) ? due : []);
  };

  const handleTest = async () => {
    setTesting(true);

    try {
      await sendReviewRequestTest({
        message: testMessage,
        phone: testPhone,
      });
      pushNotification?.({
        title: "Тестовый запрос отзыва отправлен",
        message: "Проверьте SMS на телефоне",
      });
    } catch (error) {
      pushNotification?.({
        title: "Тест не выполнен",
        message: error?.message || "Проверьте SMSAPI_TOKEN на backend",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="panel settings-panel booksy-sync-panel">
      <SettingsPanelHeading
        hint="Авто-SMS через SMSAPI.pl через N часов после завершённого визита"
        icon="star"
        title="Запрос отзыва после визита"
      />

      <div className="booksy-sync-status">
        <strong>
          {status.configured
            ? "SMSAPI подключён на сервере"
            : "Нужен SMSAPI_TOKEN на backend"}
        </strong>
        <span>
          К отправке сейчас: {status.dueCount}
          {status.skippedCount ? ` · пропусков: ${status.skippedCount}` : ""}
        </span>
        {status.lastRunAt ? (
          <small>
            Последний запуск:{" "}
            {new Date(status.lastRunAt).toLocaleString("ru-RU", {
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              month: "2-digit",
            })}
          </small>
        ) : null}
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
          onClick={() => onProcess?.()}>
          Отправить сейчас
        </Button>
      </div>

      {preview.length > 0 ? (
        <div className="client-packages-list">
          {preview.map((item) => (
            <article
              className="client-package-card certificate-card"
              key={item.key || `${item.calendarEntryId}-${item.time}`}>
              <div className="client-package-main">
                <strong>
                  {item.client || "Клиент"} · {item.time}
                </strong>
                <span>{item.date}</span>
                <small>{item.message || item.error || item.status}</small>
              </div>
              <div className="client-package-meta">
                <span>{item.phone || item.telegram || "—"}</span>
                {item.telegramLink ? (
                  <a
                    className="secondary-button"
                    href={item.telegramLink}
                    rel="noreferrer"
                    target="_blank">
                    <AppIcon name="external" size="xs" />
                    Telegram
                  </a>
                ) : null}
                <b>{item.status}</b>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="settings-options settings-options-grid">
        <Field label="Тестовый телефон">
          <Input
            placeholder="600123456"
            value={testPhone}
            onChange={(event) => setTestPhone(event.target.value)}
          />
        </Field>
        <Field label="Тестовое сообщение">
          <Textarea
            rows="3"
            value={testMessage}
            onChange={(event) => setTestMessage(event.target.value)}
          />
        </Field>
      </div>
      <Button
        disabled={testing || !testPhone.trim()}
        leftIcon="message"
        loading={testing}
        type="button"
        variant="secondary"
        onClick={handleTest}>
        Отправить тестовое SMS
      </Button>

      <p className="field-hint">
        Автоотправка работает через SMS. Для Telegram в предпросмотре доступна
        ссылка с готовым текстом. Для автозапуска используйте worker/cron на Hetzner.
      </p>
    </section>
  );
}

export default ReviewRequestsPanel;
