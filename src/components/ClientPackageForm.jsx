import {useMemo, useState} from "react";
import {paymentMethods} from "../constants/paymentMethods.js";
import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {toInputDate} from "../utils/formatters.jsx";
import {Button} from "./ui/index.js";

const packagePaymentMethods = paymentMethods.filter(
  (method) => method !== "Пакет" && method !== "Сертификат",
);

function ClientPackageForm({
  clients,
  employees = [],
  packages,
  clientPackage,
  onSubmit,
}) {
  const [selectedPackageId, setSelectedPackageId] = useState(
    clientPackage?.packageId ?? packages[0]?.id ?? "",
  );
  const selectedPackage = useMemo(
    () =>
      packages.find((packageItem) => packageItem.id === Number(selectedPackageId)),
    [packages, selectedPackageId],
  );
  const totalVisits =
    clientPackage?.totalVisits ?? selectedPackage?.visitsCount ?? "";
  const remainingVisits = clientPackage?.remainingVisits ?? totalVisits;
  const price = clientPackage?.price ?? selectedPackage?.price ?? "";

  return (
    <section className="panel package-form-panel package-form-sheet-root">
      <h2>{clientPackage ? "Остаток пакета" : "Продать пакет"}</h2>
      <form className="catalog-form" onSubmit={onSubmit}>
        <label>
          Клиент
          <ClientAutocomplete
            clients={clients}
            defaultValue={clientPackage?.client ?? ""}
            id="package-client-options"
            required
          />
        </label>
        <label>
          Пакет
          {clientPackage && (
            <input
              name="packageTemplateId"
              type="hidden"
              value={clientPackage.packageId}
            />
          )}
          <select
            name="packageTemplateId"
            value={selectedPackageId}
            disabled={Boolean(clientPackage)}
            required
            onChange={(event) => setSelectedPackageId(event.target.value)}>
            {packages.map((packageItem) => (
              <option key={packageItem.id} value={packageItem.id}>
                {packageItem.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-split">
          <label>
            Дата покупки
            <input
              name="purchaseDate"
              type="date"
              defaultValue={toInputDate(clientPackage?.purchaseDate)}
            />
          </label>
          <label>
            Кто продал
            <select name="master" defaultValue={clientPackage?.master ?? ""}>
              <option value="">Не указан</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.name}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-split">
          <label>
            Оплата
            <select name="payment" defaultValue={clientPackage?.payment ?? "Наличные"}>
              {packagePaymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </label>
          <label>
            Сумма продажи
            <input name="price" defaultValue={price} placeholder="0" />
          </label>
        </div>
        <div className="form-split" key={selectedPackageId}>
          <label>
            Всего визитов
            <input
              name="totalVisits"
              defaultValue={totalVisits}
              placeholder="0"
            />
          </label>
          <label>
            Остаток
            <input
              name="remainingVisits"
              defaultValue={remainingVisits}
              placeholder="0"
            />
          </label>
        </div>
        <label>
          Статус
          <select name="status" defaultValue={clientPackage?.status ?? "Активен"}>
            <option>Активен</option>
            <option>Пауза</option>
            <option>Архив</option>
          </select>
          <small className="field-hint">
            Пакет с нулевым остатком автоматически попадает в архив.
          </small>
        </label>
        <Button
          className="crm-primary-action package-form-submit"
          size="lg"
          type="submit"
          variant="primary">
          {clientPackage ? "Сохранить остаток" : "Продать пакет"}
        </Button>
      </form>
    </section>
  );
}

export default ClientPackageForm;
