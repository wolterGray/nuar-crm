import { Plus } from 'lucide-react'

function NewVisitForm({ clients, masters, services, initialVisit, onSubmit }) {
  return (
    <section className="panel new-visit-panel">
      <h2>Новый визит</h2>
      <form onSubmit={onSubmit}>
        <div className="form-section visit-main-fields">
          <label>
            Клиент
            <div className="inline-field">
              <select name="client" defaultValue={initialVisit?.client ?? ''} required>
                <option value="" disabled>
                  Выберите клиента
                </option>
                {clients.map((client) => (
                  <option key={client}>{client}</option>
                ))}
              </select>
              <button type="button" aria-label="Добавить клиента">
                <Plus size={18} />
              </button>
            </div>
          </label>
          <label>
            Дата
            <input
              name="date"
              type="date"
              defaultValue={initialVisit?.date ?? '2024-05-15'}
              required
            />
          </label>
        </div>
        <div className="form-section visit-service-fields">
          <label>
            Услуга
            <select name="service" defaultValue={initialVisit?.service ?? ''} required>
              <option value="" disabled>
                Выберите услугу
              </option>
              {services.map((service) => (
                <option key={service}>{service}</option>
              ))}
            </select>
          </label>
          <label>
            Работник
            <select name="master" defaultValue={initialVisit?.master ?? ''} required>
              <option value="" disabled>
                Выберите работника
              </option>
              {masters.map((master) => (
                <option key={master}>{master}</option>
            ))}
          </select>
        </label>
        </div>
        <div className="form-section visit-payment-fields">
          <label>
            Оплата
            <select name="payment" defaultValue={initialVisit?.payment ?? 'Наличные'}>
              <option>Наличные</option>
              <option>Карта</option>
              <option>Пакет</option>
              <option>Крипта</option>
            </select>
          </label>
        </div>
        <div className="form-section visit-money-fields">
          <label>
            Сумма услуги
            <input name="amount" placeholder="0" defaultValue={initialVisit?.amount ?? ''} />
          </label>
          <label>
            Чай
            <input name="tip" placeholder="0" defaultValue={initialVisit?.tip ?? ''} />
          </label>
          <label>
            Комиссия
            <input
              name="commission"
              placeholder="0"
              defaultValue={initialVisit?.commission ?? ''}
            />
          </label>
          <label>
            Доп сумма
            <input name="extra" placeholder="0" defaultValue={initialVisit?.extra ?? ''} />
          </label>
          <label>
            Скидка
            <input
              name="discount"
              placeholder="0"
              defaultValue={initialVisit?.discount ?? ''}
            />
          </label>
        </div>
        <button className="submit-button">
          {initialVisit ? 'Сохранить изменения' : 'Добавить визит'}
        </button>
      </form>
    </section>
  )
}

export default NewVisitForm
