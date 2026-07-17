import {Users} from "lucide-react";
import {useState} from "react";
import {SettingsPanelHeading} from "./HintIcon.jsx";
import {defaultInactiveFollowUpTemplates} from "../utils/inactiveFollowUp.js";
import {sendInactiveFollowUpTest} from "../utils/inactiveFollowUpApi.js";
import {Button, Field, Input, Textarea} from "./ui/index.js";

function InactiveFollowUpPanel({
  onPreview,
  onProcess,
  onRefreshStatus,
  pushNotification,
  status,
}) {
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState(
    defaultInactiveFollowUpTemplates["14d"].replace("{name}", "Anna").replace(
      "{days}",
      "14",
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
      await sendInactiveFollowUpTest({
        message: testMessage,
        phone: testPhone,
      });
      pushNotification?.({
        title: "Тестовый follow-up отправлен",
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
        hint="Авто-SMS через 14, 30 и 60 дней без визита через SMSAPI.pl"
        icon={Users}
        title="Follow-up неактивных клиентов"
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
              key={item.key || `${item.clientId}-${item.kind}`}>
              <div className="client-package-main">
                <strong>
                  {item.kind} · {item.client || "Клиент"}
                </strong>
                <span>
                  {item.daysAbsent} дн. · последний визит {item.lastVisit || "—"}
                </span>
                <small>{item.message || item.error || item.status}</small>
              </div>
              <div className="client-package-meta">
                <span>{item.phone || item.telegram || "—"}</span>
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
        Клиентам с будущей записью SMS не отправляется. Для автозапуска используйте
        worker/cron на Hetzner.
      </p>
    </section>
  );
}

export default InactiveFollowUpPanel;
