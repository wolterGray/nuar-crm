import {useMemo, useState} from "react";
import ClientAutocomplete from "./ClientAutocomplete.jsx";

const fallbackColors = ["#4f8edc", "#8b6fd6", "#45a873", "#d78a42", "#c75b78"];
const toMinutes = (time) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);
  return hours * 60 + minutes;
};
const toTime = (minutes) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;

function CalendarEntryForm({
  initialEntry,
  clients,
  clientPackages,
  employees,
  services,
  selectedDate,
  selectedClient,
  selectedAmount,
  selectedDuration,
  selectedKind,
  selectedMaster,
  selectedPayment,
  selectedServiceId,
  selectedTime,
  onSubmit,
}) {
  const [kind, setKind] = useState(initialEntry?.kind ?? selectedKind ?? "visit");
  const [client, setClient] = useState(initialEntry?.client ?? selectedClient ?? "");
  const [serviceId, setServiceId] = useState(initialEntry?.serviceId ?? selectedServiceId ?? "");
  const [duration, setDuration] = useState(initialEntry?.duration ?? selectedDuration ?? 60);
  const [time, setTime] = useState(initialEntry?.time ?? selectedTime ?? "10:00");
  const [endTime, setEndTime] = useState(() =>
    toTime(
      toMinutes(initialEntry?.time ?? selectedTime ?? "10:00") +
        Number(initialEntry?.duration ?? 60),
    ),
  );
  const [payment, setPayment] = useState(initialEntry?.payment ?? selectedPayment ?? "Наличные");
  const [amount, setAmount] = useState(initialEntry?.amount ?? selectedAmount ?? "");
  const service = services.find((item) => String(item.id) === String(serviceId));
  const packageOptions = useMemo(
    () =>
      clientPackages.filter(
        (item) =>
          item.client === client &&
          item.status !== "Архив" &&
          Number(item.remainingVisits) > 0,
      ),
    [client, clientPackages],
  );
  const durationOptions = useMemo(
    () =>
      [...new Set([30, 45, 60, 75, 90, 120, ...(service?.variants ?? []).map((variant) => Number(variant.duration))])]
        .filter(Boolean)
        .sort((first, second) => first - second),
    [service],
  );

  return (
    <form className="calendar-entry-form" onSubmit={onSubmit}>
      {!initialEntry && <div className="calendar-kind-switch">
        <button
          className={kind === "visit" ? "active" : ""}
          type="button"
          onClick={() => setKind("visit")}>
          Клиент
        </button>
        <button
          className={kind === "reserved" ? "active" : ""}
          type="button"
          onClick={() => setKind("reserved")}>
          Резерв
        </button>
      </div>}
      <input name="kind" type="hidden" value={kind} />
      <div className="calendar-entry-grid calendar-entry-time-grid">
        <label className="calendar-entry-date-field">
          Дата
          <input name="date" type="date" defaultValue={initialEntry?.date ?? selectedDate} />
        </label>
        <label className="calendar-entry-start-field">
          Время
          <input
            name="time"
            type="time"
            step="900"
            value={time}
            onChange={(event) => {
              const nextTime = event.target.value;
              const currentDuration = Math.max(15, toMinutes(endTime) - toMinutes(time));
              setTime(nextTime);
              setEndTime(toTime(toMinutes(nextTime) + currentDuration));
            }}
          />
        </label>
        {kind === "visit" ? <label>
          Длительность
          <select
            name="duration"
            value={duration}
            onChange={(event) => {
              const nextDuration = Number(event.target.value);
              const nextVariant = service?.variants?.find(
                (variant) => Number(variant.duration) === nextDuration,
              );
              setDuration(nextDuration);
              if (nextVariant) {
                setAmount(nextVariant.price);
              }
            }}>
            {durationOptions.map((value) => (
              <option key={value} value={value}>
                {value} мин
              </option>
            ))}
          </select>
        </label> : <label className="calendar-entry-end-field">
          Конец
          <input
            name="endTime"
            type="time"
            step="900"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </label>}
        <label>
          Мастер
          <select name="master" defaultValue={initialEntry?.master ?? selectedMaster}>
            {employees.map((employee) => (
              <option key={employee.id}>{employee.name}</option>
            ))}
          </select>
        </label>
      </div>

      {kind !== "visit" ? (
        <>
          <label>
            Причина
            <textarea
              name="title"
              defaultValue={initialEntry?.title ?? ""}
              placeholder="Причина"
              rows="3"
              required
            />
          </label>
          <input name="color" type="hidden" value={initialEntry?.color ?? "#748091"} />
        </>
      ) : (
        <>
          <label>
            Клиент
            <ClientAutocomplete
              clients={clients}
              id="calendar-client-options"
              name="client"
              value={client}
              required
              onChange={(event) => setClient(event.target.value)}
            />
          </label>
          <div className="calendar-entry-grid calendar-entry-service-grid">
            <label className="calendar-entry-service-field">
              Услуга
              <select
                name="serviceId"
                value={serviceId}
                required
                onChange={(event) => {
                  const nextService = services.find(
                    (item) => String(item.id) === String(event.target.value),
                  );
                  const nextVariant = nextService?.variants?.find(
                    (variant) => Number(variant.duration) === Number(duration),
                  );
                  setServiceId(event.target.value);
                  setAmount(nextVariant?.price ?? "");
                }}>
                <option value="">Выберите услугу</option>
                {services.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Стоимость
              <input
                name="amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Оплата
              <select
                name="payment"
                value={payment}
                onChange={(event) => setPayment(event.target.value)}>
                <option>Наличные</option>
                <option>Карта</option>
                <option>Пакет</option>
                <option>Крипта</option>
                <option>Mono</option>
                <option>BLIK</option>
                <option>Не указано</option>
              </select>
            </label>
            {payment === "Пакет" && (
              <label className="calendar-entry-package-field">
                Пакет клиента
                <select name="packageUsageId" required>
                  <option value="">Выберите пакет</option>
                  {packageOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.packageName} · осталось {item.remainingVisits}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <input
            name="color"
            type="hidden"
            value={
              service?.color ??
              fallbackColors[Math.max(0, services.indexOf(service)) % fallbackColors.length]
            }
          />
        </>
      )}
      {kind === "visit" && <label>
        Комментарий
        <textarea name="note" defaultValue={initialEntry?.note ?? ""} rows="2" />
      </label>}
      <button className="submit-button">
        {initialEntry || kind !== "visit" ? "Сохранить" : "Добавить в календарь"}
      </button>
    </form>
  );
}

export default CalendarEntryForm;
