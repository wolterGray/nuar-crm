import {UserPlus} from "lucide-react";

function NewClientForm({client, onSubmit}) {
  return (
    <section className="panel new-client-panel">
      <div className="form-title">
        <UserPlus size={18} />
        <h2>{client ? "Редактировать клиента" : "Новый клиент"}</h2>
      </div>
      <form onSubmit={onSubmit}>
        <label>
          Имя клиента
          <input
            name="name"
            defaultValue={client?.name ?? ""}
            placeholder="Например: Наталья К."
            required
          />
        </label>
        <label>
          Телефон
          <input
            name="phone"
            defaultValue={client?.phone ?? ""}
            placeholder="+48 000 000 000"
          />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            defaultValue={client?.email ?? ""}
            placeholder="client@example.com"
          />
        </label>
        <label>
          Дата рождения
          <input
            name="birthday"
            type="date"
            defaultValue={client?.birthday ?? ""}
          />
        </label>
        <label>
          Instagram
          <input
            name="instagram"
            defaultValue={client?.instagram ?? ""}
            placeholder="@username или ссылка на профиль"
          />
        </label>
        <label>
          Telegram
          <input
            name="telegram"
            defaultValue={client?.telegram ?? ""}
            placeholder="@username"
          />
        </label>
        <div className="form-split">
          <label>
            Источник
            <select name="source" defaultValue={client?.source ?? "Instagram"}>
              <option>Instagram</option>
              <option>Booksy</option>
              <option>Google</option>
              <option>Рекомендация</option>
              <option>Проходил мимо</option>
            </select>
          </label>
          <label>
            Предпочтение
            <select
              name="preference"
              defaultValue={client?.preference ?? "Любой мастер"}>
              <option>Любой мастер</option>
              <option>Ольга</option>
              <option>Максим</option>
              <option>Новая мастер</option>
            </select>
          </label>
        </div>
        <div className="form-split">
          <label>
            Статус клиента
            <select name="status" defaultValue={client?.status ?? "Активный"}>
              <option>Активный</option>
              <option>VIP</option>
              <option>Новый</option>
              <option>Пауза</option>
              <option>Не беспокоить</option>
            </select>
          </label>
          <label>
            Теги
            <input
              name="tags"
              defaultValue={client?.tags ?? ""}
              placeholder="VIP, спорт, поляк"
            />
          </label>
        </div>
        <label>
          Комментарий
          <textarea
            name="note"
            defaultValue={client?.note ?? ""}
            placeholder="Аллергии, противопоказания, пожелания"
            rows="3"
          />
        </label>
        <button className="submit-button">
          {client ? "Сохранить клиента" : "Добавить клиента"}
        </button>
      </form>
    </section>
  );
}

export default NewClientForm;
