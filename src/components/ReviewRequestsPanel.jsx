import {ExternalLink, LoaderCircle, MessageSquareText, Play, RefreshCw, Send, Star} from "lucide-react";
import {useState} from "react";
import {SettingsPanelHeading} from "./HintIcon.jsx";
import {defaultReviewRequestTemplate} from "../utils/reviewRequests.js";
import {sendReviewRequestTest} from "../utils/reviewRequestsApi.js";

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
        message: error?.message || "Проверьте SMSAPI_TOKEN в Supabase",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="panel settings-panel booksy-sync-panel">
      <SettingsPanelHeading
        hint="Авто-SMS через SMSAPI.pl через N часов после завершённого визита"
        icon={Star}
        title="Запрос отзыва после визита"
      />

      <div className="booksy-sync-status">
        <strong>
          {status.configured
            ? "SMSAPI подключён на сервере"
            : "Нужен SMSAPI_TOKEN в Supabase Edge Functions"}
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
          onClick={() => onProcess?.()}>
          <Send size={16} />
          Отправить сейчас
        </button>
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
                    <ExternalLink size={14} />
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
        <label>
          Тестовый телефон
          <input
            placeholder="600123456"
            value={testPhone}
            onChange={(event) => setTestPhone(event.target.value)}
          />
        </label>
        <label>
          Тестовое сообщение
          <textarea
            rows="3"
            value={testMessage}
            onChange={(event) => setTestMessage(event.target.value)}
          />
        </label>
      </div>
      <button
        className="secondary-button"
        disabled={testing || !testPhone.trim()}
        type="button"
        onClick={handleTest}>
        {testing ? <LoaderCircle className="spin" size={16} /> : <MessageSquareText size={16} />}
        Отправить тестовое SMS
      </button>

      <p className="field-hint">
        Автоотправка работает через SMS. Для Telegram в предпросмотре доступна
        ссылка с готовым текстом. Cron: `visit-review-requests` каждые 15 минут с
        `VISIT_REVIEW_CRON_SECRET`.
      </p>
    </section>
  );
}

export default ReviewRequestsPanel;
