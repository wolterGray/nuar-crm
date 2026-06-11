import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {paymentMethods} from "../constants/paymentMethods.js";
import {getTodayInput} from "../utils/dateHelpers.js";
import {toInputDate} from "../utils/formatters.jsx";

function FinancialOperationForm({clients, operation, onSubmit}) {
  const operationTypes = ["Доплата", "Продажа сертификата", "Прочее поступление"];
  const operationType = operationTypes.includes(operation?.service)
    ? operation.service
    : "Доплата";

  return (
    <form className="financial-operation-form" key={operation?.id ?? "new"} onSubmit={onSubmit}>
      <label>
        Тип операции
        <select name="operationType" defaultValue={operationType}>
          {operationTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </label>
      <label>
        Клиент
        <ClientAutocomplete
          clients={clients}
          defaultValue={operation?.client ?? ""}
          id="financial-operation-client-options"
          name="client"
          placeholder="Необязательно"
        />
      </label>
      <label>
        Дата
        <input
          name="date"
          type="date"
          defaultValue={operation ? toInputDate(operation.date) : getTodayInput()}
          required
        />
      </label>
      <label>
        Способ оплаты
        <select name="payment" defaultValue={operation?.payment ?? "Наличные"}>
          {paymentMethods.map((payment) => (
            <option key={payment}>{payment}</option>
          ))}
        </select>
      </label>
      <label>
        Сумма
        <input
          min="0"
          name="extra"
          placeholder="0"
          step="0.01"
          type="number"
          defaultValue={operation?.extra ?? ""}
          required
        />
      </label>
      <label className="financial-operation-note">
        Комментарий
        <textarea
          name="note"
          defaultValue={operation?.note ?? ""}
          placeholder="Например: доплата за обертывание"
        />
      </label>
      <button className="submit-button" type="submit">
        {operation ? "Сохранить" : "Добавить поступление"}
      </button>
    </form>
  );
}

export default FinancialOperationForm;
