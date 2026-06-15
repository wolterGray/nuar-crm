import {MESSAGE_TEMPLATE_PURPOSES} from "../utils/messageTemplates.js";

function MessageTemplateForm({template, onSubmit}) {
  return (
    <section className="panel message-template-form-panel message-template-form-sheet-root">
      <h2>{template ? "Редактировать шаблон" : "Новый шаблон"}</h2>
      <form className="catalog-form message-template-form" onSubmit={onSubmit}>
        <label>
          Название шаблона
          <input
            name="name"
            defaultValue={template?.name ?? ""}
            placeholder="Напоминание о визите"
            required
          />
        </label>
        <div className="message-template-form-grid">
          <label>
            Канал
            <select name="channel" defaultValue={template?.channel ?? "SMS"}>
              <option>SMS</option>
              <option>Email</option>
            </select>
          </label>
          <label>
            Язык
            <select name="language" defaultValue={template?.language ?? "Русский"}>
              <option>Русский</option>
              <option>Польский</option>
              <option>Английский</option>
              <option>Украинский</option>
            </select>
          </label>
          <label>
            Аудитория
            <select name="audience" defaultValue={template?.audience ?? "Все"}>
              <option>Все</option>
              <option>Девушки</option>
              <option>Парни</option>
              <option>Поляки</option>
              <option>Англичане</option>
              <option>Украинцы</option>
            </select>
          </label>
          <label>
            Назначение
            <select name="purpose" defaultValue={template?.purpose ?? "general"}>
              {Object.entries(MESSAGE_TEMPLATE_PURPOSES).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Тема письма
          <input
            name="subject"
            defaultValue={template?.subject ?? ""}
            placeholder="Для SMS можно оставить пустым"
          />
        </label>
        <label>
          Текст сообщения
          <textarea
            name="body"
            defaultValue={template?.body ?? ""}
            placeholder="Здравствуйте, {name}..."
            rows="7"
            required
          />
        </label>
        <small className="message-template-hint">
          {"{name}"} — имя для SMS. Для автоматических SMS выберите назначение и язык —
          CRM подставит нужный текст клиенту по полю «Язык SMS» в карточке клиента.
        </small>
        <button className="submit-button">
          {template ? "Сохранить шаблон" : "Добавить шаблон"}
        </button>
      </form>
    </section>
  );
}

export default MessageTemplateForm;
