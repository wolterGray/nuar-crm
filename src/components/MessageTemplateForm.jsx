import {MESSAGE_TEMPLATE_PURPOSES} from "../utils/messageTemplates.js";
import {Button, Field, Input, Select, Textarea} from "./ui/index.js";

function MessageTemplateForm({template, onSubmit}) {
  return (
    <section className="panel message-template-form-panel message-template-form-sheet-root">
      <h2>{template ? "Редактировать шаблон" : "Новый шаблон"}</h2>
      <form className="catalog-form message-template-form" onSubmit={onSubmit}>
        <Field label="Название шаблона">
          <Input
            name="name"
            defaultValue={template?.name ?? ""}
            placeholder="Напоминание о визите"
            required
          />
        </Field>
        <div className="message-template-form-grid">
          <Field label="Канал">
            <Select name="channel" defaultValue={template?.channel ?? "SMS"}>
              <option>SMS</option>
              <option>Email</option>
            </Select>
          </Field>
          <Field label="Язык">
            <Select name="language" defaultValue={template?.language ?? "Русский"}>
              <option>Русский</option>
              <option>Польский</option>
              <option>Английский</option>
              <option>Украинский</option>
            </Select>
          </Field>
          <Field label="Аудитория">
            <Select name="audience" defaultValue={template?.audience ?? "Все"}>
              <option>Все</option>
              <option>Девушки</option>
              <option>Парни</option>
              <option>Поляки</option>
              <option>Англичане</option>
              <option>Украинцы</option>
            </Select>
          </Field>
          <Field label="Назначение">
            <Select name="purpose" defaultValue={template?.purpose ?? "general"}>
              {Object.entries(MESSAGE_TEMPLATE_PURPOSES).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Тема письма">
          <Input
            name="subject"
            defaultValue={template?.subject ?? ""}
            placeholder="Для SMS можно оставить пустым"
          />
        </Field>
        <Field label="Текст сообщения">
          <Textarea
            name="body"
            defaultValue={template?.body ?? ""}
            placeholder="Здравствуйте, {name}..."
            rows="7"
            required
          />
        </Field>
        <small className="message-template-hint">
          {"{name}"} — имя для SMS. Для автоматических SMS выберите назначение и язык —
          CRM подставит нужный текст клиенту по полю «Язык SMS» в карточке клиента.
        </small>
        <Button
          className="crm-primary-action message-template-form-submit"
          size="lg"
          type="submit"
          variant="primary">
          {template ? "Сохранить шаблон" : "Добавить шаблон"}
        </Button>
      </form>
    </section>
  );
}

export default MessageTemplateForm;
