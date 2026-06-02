import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {paymentMethods} from "../data/seed.js";

const getTodayInput = () => new Date().toISOString().slice(0, 10);

function FinancialOperationForm({clients, onSubmit}) {
  return (
    <form className="financial-operation-form" onSubmit={onSubmit}>
      <label>
        Тип операции
        <select name="operationType" defaultValue="Доплата">
          <option>Доплата</option>
          <option>Продажа сертификата</option>
          <option>Прочее поступление</option>
        </select>
      </label>
      <label>
        Клиент
        <ClientAutocomplete
          clients={clients}
          id="financial-operation-client-options"
          name="client"
          placeholder="Необязательно"
        />
      </label>
      <label>
        Дата
        <input name="date" type="date" defaultValue={getTodayInput()} required />
      </label>
      <label>
        Способ оплаты
        <select name="payment" defaultValue="Наличные">
          {paymentMethods.map((payment) => (
            <option key={payment}>{payment}</option>
          ))}
        </select>
      </label>
      <label>
        Сумма
        <input min="0" name="extra" placeholder="0" step="0.01" type="number" required />
      </label>
      <label className="financial-operation-note">
        Комментарий
        <textarea name="note" placeholder="Например: доплата за обертывание" />
      </label>
      <button className="submit-button" type="submit">
        Добавить поступление
      </button>
    </form>
  );
}

export default FinancialOperationForm;
