import {useMemo, useState} from "react";
import {paymentMethods} from "../constants/paymentMethods.js";
import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {generateCertificateCode} from "../utils/certificates.js";
import {toInputDate} from "../utils/formatters.jsx";
import {getTodayInput} from "../utils/dateHelpers.js";

const certificatePaymentMethods = paymentMethods.filter(
  (method) => method !== "Пакет" && method !== "Сертификат",
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
    <section className="panel package-form-panel">
      <h2>{certificate ? "Редактировать сертификат" : "Продать сертификат"}</h2>
      <form className="catalog-form" onSubmit={onSubmit}>
        <label>
          Код сертификата
          <input
            name="code"
            defaultValue={generatedCode}
            placeholder="NUAR-XXXXXX"
            readOnly={!certificate}
          />
          {!certificate && (
            <small className="field-hint">
              Код генерируется автоматически при продаже.
            </small>
          )}
        </label>
        <label>
          Покупатель
          <ClientAutocomplete
            clients={clients}
            defaultValue={certificate?.client ?? ""}
            id="certificate-client-options"
            required
          />
        </label>
        <label>
          Получатель
          <ClientAutocomplete
            clients={clients}
            defaultValue={certificate?.recipient ?? certificate?.client ?? ""}
            id="certificate-recipient-options"
            placeholder="Если пусто — совпадает с покупателем"
          />
          <small className="field-hint">
            Кому можно предъявить сертификат при визите.
          </small>
        </label>
        <div className="form-split">
          <label>
            Номинал
            <input
              name="nominal"
              defaultValue={certificate?.nominal ?? ""}
              placeholder="500"
              required
            />
          </label>
          {certificate ? (
            <label>
              Остаток
              <input
                name="remainingBalance"
                defaultValue={certificate?.remainingBalance ?? ""}
                placeholder="0"
              />
            </label>
          ) : (
            <label>
              Срок действия, дней
              <input
                name="validityDays"
                value={validityDays}
                placeholder="365"
                onChange={(event) => setValidityDays(event.target.value)}
              />
            </label>
          )}
        </div>
        <div className="form-split">
          <label>
            Дата продажи
            <input
              name="purchaseDate"
              type="date"
              defaultValue={
                toInputDate(certificate?.purchaseDate) || getTodayInput()
              }
            />
          </label>
          <label>
            Срок действия
            <input
              name="expiryDate"
              type="date"
              defaultValue={toInputDate(certificate?.expiryDate)}
            />
          </label>
        </div>
        <div className="form-split">
          <label>
            Оплата
            <select
              name="payment"
              defaultValue={certificate?.payment ?? "Наличные"}>
              {certificatePaymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </select>
          </label>
          <label>
            Кто продал
            <select name="master" defaultValue={certificate?.master ?? ""}>
              <option value="">Не указан</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.name}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {certificate ? (
          <label>
            Статус
            <select name="status" defaultValue={certificate?.status ?? "Активен"}>
              <option>Активен</option>
              <option>Частично</option>
              <option>Погашен</option>
              <option>Просрочен</option>
              <option>Архив</option>
            </select>
          </label>
        ) : null}
        <label>
          Заметка
          <textarea
            name="note"
            defaultValue={certificate?.note ?? ""}
            placeholder="Повод, упаковка, комментарий"
            rows="3"
          />
        </label>
        <button className="submit-button">
          {certificate ? "Сохранить сертификат" : "Продать сертификат"}
        </button>
      </form>
    </section>
  );
}

export default CertificateForm;
