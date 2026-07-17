import {useMemo, useState} from "react";
import {paymentMethods} from "../constants/paymentMethods.js";
import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {toInputDate} from "../utils/formatters.jsx";
import {Button, Field, Input, Select} from "./ui/index.js";

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
      <h2>{clientPackage?.id ? "Остаток пакета" : "Продать пакет"}</h2>
      <form className="catalog-form" onSubmit={onSubmit}>
        <Field label="Клиент">
          <ClientAutocomplete
            clients={clients}
            defaultValue={clientPackage?.client ?? ""}
            id="package-client-options"
            required
          />
        </Field>
        <Field label="Пакет">
          {clientPackage?.id && (
            <input
              name="packageTemplateId"
              type="hidden"
              value={clientPackage.packageId}
            />
          )}
          <Select
            name="packageTemplateId"
            value={selectedPackageId}
            disabled={Boolean(clientPackage?.id)}
            required
            onChange={(event) => setSelectedPackageId(event.target.value)}>
            {packages.map((packageItem) => (
              <option key={packageItem.id} value={packageItem.id}>
                {packageItem.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="form-split">
          <Field label="Дата покупки">
            <Input
              name="purchaseDate"
              type="date"
              defaultValue={toInputDate(clientPackage?.purchaseDate)}
            />
          </Field>
          <Field label="Кто продал">
            <Select name="master" defaultValue={clientPackage?.master ?? ""}>
              <option value="">Не указан</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.name}>
                  {employee.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="form-split">
          <Field label="Оплата">
            <Select name="payment" defaultValue={clientPackage?.payment ?? "Наличные"}>
              {packagePaymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </Select>
          </Field>
          <Field label="Сумма продажи">
            <Input name="price" defaultValue={price} placeholder="0" />
          </Field>
        </div>
        <div className="form-split" key={selectedPackageId}>
          <Field label="Всего визитов">
            <Input
              name="totalVisits"
              defaultValue={totalVisits}
              placeholder="0"
            />
          </Field>
          <Field label="Остаток">
            <Input
              name="remainingVisits"
              defaultValue={remainingVisits}
              placeholder="0"
            />
          </Field>
        </div>
        <Field
          description="Пакет с нулевым остатком автоматически попадает в архив."
          label="Статус">
          <Select name="status" defaultValue={clientPackage?.status ?? "Активен"}>
            <option>Активен</option>
            <option>Пауза</option>
            <option>Архив</option>
          </Select>
        </Field>
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
