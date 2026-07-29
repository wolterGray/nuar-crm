import {useMemo, useState} from "react";
import {paymentMethods} from "../constants/paymentMethods.js";
import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {generateCertificateCode} from "../utils/certificates.js";
import {toInputDate} from "../utils/formatters.jsx";
import {getTodayInput} from "../utils/dateHelpers.js";
import {Button, Field, Input, Select, Textarea} from "./ui/index.js";

const certificatePaymentMethods = paymentMethods.filter(
  (method) => method !== "Пакет" && method !== "Сертификат" && method !== "Наличные + карта",
);

function CertificateForm({
  certificate,
  certificates = [],
  clients,
  employees = [],
  onSubmit,
}) {
  const [validityDays, setValidityDays] = useState(
    certificate?.validityDays ?? 365,
  );
  const generatedCode = useMemo(
    () =>
      certificate?.code ??
      generateCertificateCode(certificates.map((item) => item.code)),
    [certificate?.code, certificates],
  );

  return (
    <section className="panel package-form-panel package-form-sheet-root">
      <h2>{certificate ? "Редактировать сертификат" : "Продать сертификат"}</h2>
      <form className="catalog-form" onSubmit={onSubmit}>
        <Field
          description={!certificate ? "Код генерируется автоматически при продаже." : undefined}
          label="Код сертификата">
          <Input
            name="code"
            defaultValue={generatedCode}
            placeholder="NUAR-XXXXXX"
            readOnly={!certificate}
          />
        </Field>
        <Field label="Покупатель">
          <ClientAutocomplete
            clients={clients}
            defaultValue={certificate?.client ?? ""}
            id="certificate-client-options"
            required
          />
        </Field>
        <Field
          description="Кому можно предъявить сертификат при визите."
          label="Получатель">
          <ClientAutocomplete
            clients={clients}
            defaultValue={certificate?.recipient ?? certificate?.client ?? ""}
            id="certificate-recipient-options"
            placeholder="Если пусто — совпадает с покупателем"
          />
        </Field>
        <div className="form-split">
          <Field label="Номинал">
            <Input
              name="nominal"
              defaultValue={certificate?.nominal ?? ""}
              placeholder="500"
              required
            />
          </Field>
          {certificate ? (
            <Field label="Остаток">
              <Input
                name="remainingBalance"
                defaultValue={certificate?.remainingBalance ?? ""}
                placeholder="0"
              />
            </Field>
          ) : (
            <Field label="Срок действия, дней">
              <Input
                name="validityDays"
                value={validityDays}
                placeholder="365"
                onChange={(event) => setValidityDays(event.target.value)}
              />
            </Field>
          )}
        </div>
        <div className="form-split">
          <Field label="Дата продажи">
            <Input
              name="purchaseDate"
              type="date"
              defaultValue={
                toInputDate(certificate?.purchaseDate) || getTodayInput()
              }
            />
          </Field>
          <Field label="Срок действия">
            <Input
              name="expiryDate"
              type="date"
              defaultValue={toInputDate(certificate?.expiryDate)}
            />
          </Field>
        </div>
        <div className="form-split">
          <Field label="Оплата">
            <Select
              name="payment"
              defaultValue={certificate?.payment ?? "Наличные"}>
              {certificatePaymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </Select>
          </Field>
          <Field label="Кто продал">
            <Select name="master" defaultValue={certificate?.master ?? ""}>
              <option value="">Не указан</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.name}>
                  {employee.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {certificate ? (
          <Field label="Статус">
            <Select name="status" defaultValue={certificate?.status ?? "Активен"}>
              <option>Активен</option>
              <option>Частично</option>
              <option>Погашен</option>
              <option>Просрочен</option>
              <option>Архив</option>
            </Select>
          </Field>
        ) : null}
        <Field label="Заметка">
          <Textarea
            name="note"
            defaultValue={certificate?.note ?? ""}
            placeholder="Повод, упаковка, комментарий"
            rows="3"
          />
        </Field>
        <Button
          className="crm-primary-action package-form-submit"
          size="lg"
          type="submit"
          variant="primary">
          {certificate ? "Сохранить сертификат" : "Продать сертификат"}
        </Button>
      </form>
    </section>
  );
}

export default CertificateForm;
