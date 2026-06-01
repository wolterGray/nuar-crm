function MessageTemplateForm({template, onSubmit}) {
  return (
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
        Используйте {"{name}"} для имени клиента.
      </small>
      <button className="submit-button">
        {template ? "Сохранить шаблон" : "Добавить шаблон"}
      </button>
    </form>
  );
}

export default MessageTemplateForm;
