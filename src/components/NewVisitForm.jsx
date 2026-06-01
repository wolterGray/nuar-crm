import {useMemo, useState} from 'react'
import { Plus } from 'lucide-react'
import ClientAutocomplete from './ClientAutocomplete.jsx'

const getTodayInput = () => {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function NewVisitForm({
  clients,
  clientPackages,
  masters,
  services,
  initialVisit,
  onSubmit,
}) {
  const [selectedClient, setSelectedClient] = useState(initialVisit?.client ?? '')
  const [selectedPayment, setSelectedPayment] = useState(
    initialVisit?.payment ?? 'Наличные',
  )
  const availablePackages = useMemo(
    () =>
      clientPackages.filter(
        (packageItem) =>
          packageItem.client === selectedClient &&
          packageItem.status !== 'Архив' &&
          (packageItem.remainingVisits > 0 ||
            packageItem.id === initialVisit?.packageUsageId),
      ),
    [clientPackages, initialVisit?.packageUsageId, selectedClient],
  )

  return (
    <section className="panel new-visit-panel">
      <h2>Новый визит</h2>
      <form onSubmit={onSubmit}>
        <div className="form-section visit-main-fields">
          <label>
            Клиент
            <div className="inline-field">
              <ClientAutocomplete
                clients={clients}
                id="new-visit-client-options"
                name="client"
                value={selectedClient}
                required
                onChange={(event) => setSelectedClient(event.target.value)}
              />
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
              defaultValue={initialVisit?.date ?? getTodayInput()}
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
            <select
              name="payment"
              value={selectedPayment}
              onChange={(event) => setSelectedPayment(event.target.value)}
            >
              <option>Наличные</option>
              <option>Карта</option>
              <option>Пакет</option>
              <option>Крипта</option>
              <option>Mono</option>
              <option>BLIK</option>
              <option>Бартер</option>
              <option>Не указано</option>
            </select>
          </label>
          {selectedPayment === 'Пакет' && (
            <>
              <label>
                Пакет клиента
                <select
                  name="packageUsageId"
                  defaultValue={initialVisit?.packageUsageId ?? ''}
                  required
                >
                  <option value="" disabled>
                    Выберите пакет
                  </option>
                  {availablePackages.map((packageItem) => (
                    <option key={packageItem.id} value={packageItem.id}>
                      {packageItem.packageName} · осталось {packageItem.remainingVisits}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Списать визитов
                <input
                  name="packageSessionsUsed"
                  defaultValue={initialVisit?.packageSessionsUsed ?? 1}
                  placeholder="1"
                />
              </label>
            </>
          )}
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
            <select
              name="commissionType"
              defaultValue={initialVisit?.commissionType ?? 'Без комиссии'}
            >
              <option>Без комиссии</option>
              <option>Booksy 45%</option>
            </select>
          </label>
          <label>
            Доп сумма
            <input name="extra" placeholder="0" defaultValue={initialVisit?.extra ?? ''} />
          </label>
          <label>
            Скидка %
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
