import { UserPlus } from 'lucide-react'

function NewClientForm({ onSubmit }) {
  return (
    <section className="panel new-client-panel">
      <div className="form-title">
        <UserPlus size={18} />
        <h2>Новый клиент</h2>
      </div>
      <form onSubmit={onSubmit}>
        <label>
          Имя клиента
          <input name="name" placeholder="Например: Наталья К." required />
        </label>
        <label>
          Телефон
          <input name="phone" placeholder="+48 000 000 000" required />
        </label>
        <div className="form-split">
          <label>
            Источник
            <select name="source" defaultValue="Instagram">
              <option>Instagram</option>
              <option>Google</option>
              <option>Рекомендация</option>
              <option>Проходил мимо</option>
            </select>
          </label>
          <label>
            Предпочтение
            <select name="preference" defaultValue="Любой мастер">
              <option>Любой мастер</option>
              <option>Ольга</option>
              <option>Максим</option>
              <option>Новая мастер</option>
            </select>
          </label>
        </div>
        <label>
          Комментарий
          <textarea
            name="note"
            placeholder="Аллергии, противопоказания, пожелания"
            rows="3"
          />
        </label>
        <button className="submit-button">Сохранить клиента</button>
      </form>
    </section>
  )
}

export default NewClientForm
