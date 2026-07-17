import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {paymentMethods} from "../constants/paymentMethods.js";
import {getTodayInput} from "../utils/dateHelpers.js";
import {toInputDate} from "../utils/formatters.jsx";
import {Button, Field, Input, Select, Textarea} from "./ui/index.js";

function FinancialOperationForm({clients, operation, onSubmit}) {
  const operationTypes = ["Доплата", "Продажа сертификата", "Прочее поступление"];
  const operationType = operationTypes.includes(operation?.service)
    ? operation.service
    : "Доплата";

  return (
    <form className="financial-operation-form" key={operation?.id ?? "new"} onSubmit={onSubmit}>
      <Field label="Тип операции">
        <Select name="operationType" defaultValue={operationType}>
          {operationTypes.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </Select>
      </Field>
      <Field label="Клиент">
        <ClientAutocomplete
          clients={clients}
          defaultValue={operation?.client ?? ""}
          id="financial-operation-client-options"
          name="client"
          placeholder="Необязательно"
        />
      </Field>
      <Field label="Дата">
        <Input
          name="date"
          type="date"
          defaultValue={operation ? toInputDate(operation.date) : getTodayInput()}
          required
        />
      </Field>
      <Field label="Способ оплаты">
        <Select name="payment" defaultValue={operation?.payment ?? "Наличные"}>
          {paymentMethods.map((payment) => (
            <option key={payment}>{payment}</option>
          ))}
        </Select>
      </Field>
      <Field label="Сумма">
        <Input
          min="0"
          name="extra"
          placeholder="0"
          step="0.01"
          type="number"
          defaultValue={operation?.extra ?? ""}
          required
        />
      </Field>
      <Field className="financial-operation-note" label="Комментарий">
        <Textarea
          name="note"
          defaultValue={operation?.note ?? ""}
          placeholder="Например: доплата за обертывание"
        />
      </Field>
      <Button
        className="crm-primary-action"
        size="lg"
        type="submit"
        variant="primary">
        {operation ? "Сохранить" : "Добавить поступление"}
      </Button>
    </form>
  );
}

export default FinancialOperationForm;
