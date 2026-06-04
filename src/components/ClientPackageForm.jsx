import {useMemo, useState} from "react";
import ClientAutocomplete from "./ClientAutocomplete.jsx";

const toInputDate = (date) => {
  if (!date) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const [day, month, year] = date.split(".");
  return `${year}-${month}-${day}`;
};

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
    <section className="panel package-form-panel">
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
              <option>Наличные</option>
              <option>Карта</option>
              <option>Укр. карта</option>
              <option>Крипта</option>
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
            <option>Закончился</option>
            <option>Архив</option>
          </select>
        </label>
        <button className="submit-button">
          {clientPackage ? "Сохранить остаток" : "Продать пакет"}
        </button>
      </form>
    </section>
  );
}

export default ClientPackageForm;
