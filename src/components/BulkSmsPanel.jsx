import {Users} from "lucide-react";
import {useMemo, useState} from "react";
import {FieldLabel} from "./HintIcon.jsx";
import {
  BULK_SMS_SEGMENTS,
  defaultBulkSmsTemplate,
  summarizeBulkSmsRecipients,
} from "../utils/bulkSms.js";
import {sendBulkSmsTest} from "../utils/bulkSmsApi.js";
import {Button, Field, Input, Select, Textarea} from "./ui/index.js";

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
        message: error?.message || "Проверьте SMSAPI_TOKEN на backend",
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
            : "Нужен SMSAPI_TOKEN на backend"}
        </strong>
        <span>
          Готово к отправке: {summary.readyCount}
          {summary.skippedCount ? ` · без телефона: ${summary.skippedCount}` : ""}
        </span>
        <small>Лимит за один запуск: {bulkSms.status.maxRecipients}</small>
      </div>

      <div className="settings-options settings-options-grid">
        <Field label="Сегмент">
          <Select
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
          </Select>
        </Field>
        <Field label="Шаблон SMS">
          <Select defaultValue="" onChange={(event) => applyTemplate(event.target.value)}>
            <option value="">Свой текст ниже</option>
            {smsTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="settings-full-width">
          <FieldLabel hint='Плейсхолдеры: {name}, {studio}, {days}'>
            Текст сообщения
          </FieldLabel>
          <Textarea
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
        <Button
          disabled={bulkSms.status.loading}
          leftIcon="refresh"
          loading={bulkSms.status.loading}
          type="button"
          variant="secondary"
          onClick={() => bulkSms.refreshStatus?.()}>
          Обновить статус
        </Button>
        <Button leftIcon="eye" type="button" variant="secondary" onClick={handlePreview}>
          Предпросмотр
        </Button>
        <Button
          disabled={
            bulkSms.status.loading ||
            !bulkSms.status.configured ||
            summary.readyCount === 0
          }
          leftIcon="message"
          type="button"
          variant="primary"
          onClick={() => bulkSms.runSend?.()}>
          Отправить {summary.readyCount || ""}
        </Button>
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
        <Field label="Тестовый телефон">
          <Input
            placeholder="600123456"
            value={testPhone}
            onChange={(event) => setTestPhone(event.target.value)}
          />
        </Field>
        <Field label="Тестовое сообщение">
          <Textarea
            readOnly
            rows="3"
            value={bulkSms.template}
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
    </section>
  );
}

export default BulkSmsPanel;
