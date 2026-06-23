import {LoaderCircle, MessageSquareText, Play, RefreshCw, Send} from "lucide-react";
import {useState} from "react";
import {SettingsPanelHeading} from "./HintIcon.jsx";
import {defaultSmsReminderTemplates} from "../utils/smsReminders.js";
import {sendSmsReminderTest} from "../utils/smsRemindersApi.js";

function SmsRemindersPanel({
  onPreview,
  onProcess,
  onRefreshStatus,
  status,
}) {
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState(
    defaultSmsReminderTemplates["2h"].replace("{name}", "Anna"),
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
      await sendSmsReminderTest({
        phone: testPhone,
        message: testMessage,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="panel settings-panel booksy-sync-panel">
      <SettingsPanelHeading
        hint="Автоматические SMS за 24 часа и за 2 часа до записи через SMSAPI.pl"
        icon={MessageSquareText}
        title="SMS-напоминания о визитах"
      />

      <div className="booksy-sync-status">
        <strong>
          {status.configured
            ? "SMSAPI подключён на сервере"
            : "Нужен SMSAPI_TOKEN в Supabase Edge Functions"}
        </strong>
        <span>
          К отправке сейчас: {status.dueCount}
          {status.skippedCount ? ` · без телефона: ${status.skippedCount}` : ""}
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
            <article className="client-package-card certificate-card" key={item.key || `${item.kind}-${item.calendarEntryId}`}>
              <div className="client-package-main">
                <strong>
                  {item.kind} · {item.client || "Клиент"}
                </strong>
                <span>
                  {item.date} · {item.time}
                </span>
                <small>{item.message || item.error || item.status}</small>
              </div>
              <div className="client-package-meta">
                <span>{item.phone || "—"}</span>
                <b>{item.status}</b>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {status.recentLog?.length ? (
        <div className="booksy-sync-error">
          <strong>Последние отправки</strong>
          <ul>
            {status.recentLog.slice(0, 5).map((item) => (
              <li key={item.id}>
                {item.kind} · {item.client} · {item.status}
                {item.error ? ` · ${item.error}` : ""}
              </li>
            ))}
          </ul>
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
        {testing ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
        Отправить тестовое SMS
      </button>

      <p className="field-hint">
        В Supabase → Edge Functions → Secrets добавьте `SMSAPI_TOKEN`,
        `CRM_OWNER_USER_ID`, опционально `SMSAPI_SENDER` и `VISIT_SMS_CRON_SECRET`.
        В GitHub Actions secrets нужны `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
        и опционально `VISIT_SMS_CRON_SECRET` для cron каждые 15 минут.
      </p>
    </section>
  );
}

export default SmsRemindersPanel;
