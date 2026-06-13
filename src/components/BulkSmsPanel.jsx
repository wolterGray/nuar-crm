import {LoaderCircle, MessageSquareText, Play, RefreshCw, Send, Users} from "lucide-react";
import {useMemo, useState} from "react";
import {FieldLabel} from "./HintIcon.jsx";
import {
  BULK_SMS_SEGMENTS,
  defaultBulkSmsTemplate,
  summarizeBulkSmsRecipients,
} from "../utils/bulkSms.js";
import {sendBulkSmsTest} from "../utils/bulkSmsApi.js";

function BulkSmsPanel({
  bulkSms,
  messageTemplates = [],
  onNotify,
}) {
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);
  const smsTemplates = useMemo(
    () => messageTemplates.filter((template) => template.channel === "SMS"),
    [messageTemplates],
  );
  const summary = summarizeBulkSmsRecipients(bulkSms.preview);

  const handlePreview = () => {
    bulkSms.buildPreview(bulkSms.segmentId, bulkSms.template);
  };

  const applyTemplate = (templateId) => {
    const selected = smsTemplates.find(
      (template) => String(template.id) === String(templateId),
    );

    if (!selected) {
      bulkSms.setTemplateName("Bulk SMS");
      bulkSms.setTemplate(defaultBulkSmsTemplate);
      bulkSms.setPreview([]);
      return;
    }

    bulkSms.setTemplateName(selected.name);
    bulkSms.setTemplate(selected.body);
    bulkSms.setPreview([]);
  };

  const handleTest = async () => {
    setTesting(true);

    try {
      await sendBulkSmsTest({
        message: bulkSms.template,
        phone: testPhone,
      });
      onNotify?.({
        title: "Тестовое bulk SMS отправлено",
        message: "Проверьте SMS на телефоне",
      });
    } catch (error) {
      onNotify?.({
        title: "Тест не выполнен",
        message: error?.message || "Проверьте SMSAPI_TOKEN в Supabase",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="panel bulk-sms-panel">
      <div className="settings-panel-heading">
        <Users size={18} />
        <div>
          <h2>Bulk SMS по сегментам</h2>
          <p>Сегмент → шаблон → массовая отправка через SMSAPI.pl</p>
        </div>
      </div>

      <div className="booksy-sync-status">
        <strong>
          {bulkSms.status.configured
            ? "SMSAPI подключён на сервере"
            : "Нужен SMSAPI_TOKEN в Supabase Edge Functions"}
        </strong>
        <span>
          Готово к отправке: {summary.readyCount}
          {summary.skippedCount ? ` · без телефона: ${summary.skippedCount}` : ""}
        </span>
        <small>Лимит за один запуск: {bulkSms.status.maxRecipients}</small>
      </div>

      <div className="settings-options settings-options-grid">
        <label>
          Сегмент
          <select
            value={bulkSms.segmentId}
            onChange={(event) => {
              bulkSms.setSegmentId(event.target.value);
              bulkSms.setPreview([]);
            }}>
            {BULK_SMS_SEGMENTS.map((segment) => (
              <option key={segment.id} value={segment.id}>
                {segment.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Шаблон SMS
          <select defaultValue="" onChange={(event) => applyTemplate(event.target.value)}>
            <option value="">Свой текст ниже</option>
            {smsTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-full-width">
          <FieldLabel hint='Плейсхолдеры: {name}, {studio}, {days}'>
            Текст сообщения
          </FieldLabel>
          <textarea
            rows="4"
            value={bulkSms.template}
            onChange={(event) => {
              bulkSms.setTemplate(event.target.value);
              bulkSms.setPreview([]);
            }}
          />
        </label>
      </div>

      <div className="settings-actions-row">
        <button
          className="secondary-button"
          disabled={bulkSms.status.loading}
          type="button"
          onClick={() => bulkSms.refreshStatus?.()}>
          {bulkSms.status.loading ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <RefreshCw size={16} />
          )}
          Обновить статус
        </button>
        <button className="secondary-button" type="button" onClick={handlePreview}>
          <Play size={16} />
          Предпросмотр
        </button>
        <button
          className="add-visit-button"
          disabled={
            bulkSms.status.loading ||
            !bulkSms.status.configured ||
            summary.readyCount === 0
          }
          type="button"
          onClick={() => bulkSms.runSend?.()}>
          <Send size={16} />
          Отправить {summary.readyCount || ""}
        </button>
      </div>

      {bulkSms.preview.length > 0 ? (
        <div className="client-packages-list">
          {bulkSms.preview.map((item) => (
            <article
              className="client-package-card certificate-card"
              key={item.clientId}>
              <div className="client-package-main">
                <strong>{item.clientName}</strong>
                <span>
                  {item.daysAbsent != null
                    ? `${item.daysAbsent} дн. без визита`
                    : item.lastVisit
                      ? `Последний визит ${item.lastVisit}`
                      : "—"}
                </span>
                <small>{item.message}</small>
              </div>
              <div className="client-package-meta">
                <span>{item.phone || "—"}</span>
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
            readOnly
            rows="3"
            value={bulkSms.template}
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
    </section>
  );
}

export default BulkSmsPanel;
