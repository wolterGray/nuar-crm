import {useMemo, useState} from "react";
import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {getPackageProgressLabel, isUpcomingPackageVisit} from "../utils/packages.jsx";

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
  calendarEntries,
  clients,
  clientPackages,
  employees,
  visits = [],
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
  onCreateClient,
  onSubmit,
}) {
  const [kind, setKind] = useState(initialEntry?.kind ?? selectedKind ?? "visit");
  const [client, setClient] = useState(initialEntry?.client ?? selectedClient ?? "");
  const [master, setMaster] = useState(
    initialEntry?.master ?? selectedMaster ?? employees[0]?.name ?? "",
  );
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
  const [commissionType, setCommissionType] = useState(
    initialEntry?.commissionType ?? "Без комиссии",
  );
  const [tip, setTip] = useState(initialEntry?.tip ?? "");
  const [extra, setExtra] = useState(initialEntry?.extra ?? "");
  const [debt, setDebt] = useState(initialEntry?.debt ?? "");
  const [discount, setDiscount] = useState(initialEntry?.discount ?? "");
  const [note, setNote] = useState(initialEntry?.note ?? "");
  const [clientTemplateApplied, setClientTemplateApplied] = useState(
    Boolean(initialEntry),
  );
  const service = services.find((item) => String(item.id) === String(serviceId));
  const clientExists = clients.some((item) => item.name === client);
  const findServiceByVisit = (visit) =>
    services.find(
      (item) =>
        String(item.id) === String(visit.serviceId) ||
        item.name === visit.service ||
        String(visit.service ?? "").startsWith(item.name) ||
        item.variants?.some((variant) => `${item.name} ${variant.duration} min.` === visit.service),
    );
  const getVisitDuration = (visit) => {
    const durationFromField = Number(visit.duration);

    if (durationFromField) {
      return durationFromField;
    }

    const [, durationFromService] =
      String(visit.service ?? "").match(/(\d+)\s*min/i) ?? [];

    return Number(durationFromService) || Number(duration) || 60;
  };
  const getVisitTimestamp = (visit) => {
    if (visit.date?.includes(".")) {
      const [day, month, year] = String(visit.date).split(".");
      return new Date(`${year}-${month}-${day}T${visit.time || "00:00"}:00`).getTime();
    }

    return new Date(`${visit.date || "1970-01-01"}T${visit.time || "00:00"}:00`).getTime();
  };
  const findPreviousVisit = (clientName) =>
    [...visits, ...calendarEntries]
      .filter(
        (visit) =>
          visit.kind !== "reserved" &&
          visit.client === clientName &&
          (!initialEntry || visit.id !== initialEntry.id),
      )
      .sort((first, second) => getVisitTimestamp(second) - getVisitTimestamp(first))[0];
  const applyClientTemplate = (clientName) => {
    const previousVisit = findPreviousVisit(clientName);

    if (!previousVisit) {
      setClientTemplateApplied(true);
      return;
    }

    const previousService = findServiceByVisit(previousVisit);
    const nextDuration = getVisitDuration(previousVisit);
    const nextVariant = previousService?.variants?.find(
      (variant) => Number(variant.duration) === nextDuration,
    );

    setServiceId(previousService?.id ?? previousVisit.serviceId ?? "");
    setDuration(nextDuration);
    setAmount(
      previousVisit.amount === "" || previousVisit.amount === undefined
        ? nextVariant?.price ?? ""
        : previousVisit.amount,
    );
    setPayment(previousVisit.payment || "Наличные");
    setCommissionType(previousVisit.commissionType || "Без комиссии");
    setTip(previousVisit.tip ?? "");
    setExtra(previousVisit.extra ?? "");
    setDebt("");
    setDiscount(previousVisit.discount ?? "");
    setNote(previousVisit.note ?? "");
    if (previousVisit.master) {
      setMaster(previousVisit.master);
    }
    setClientTemplateApplied(true);
  };
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
  const getPlannedPackageVisits = (packageItem) =>
    calendarEntries.filter(
      (entry) =>
        entry.id !== initialEntry?.id &&
        String(entry.packageUsageId) === String(packageItem.id) &&
        isUpcomingPackageVisit(entry),
    ).length + 1;

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
      {kind === "visit" && (
        <>
          <label className="calendar-entry-client-field">
            Клиент
            <ClientAutocomplete
              clients={clients}
              id="calendar-client-options"
              name="client"
              value={client}
              required
              onChange={(event) => {
                const nextClient = event.target.value;
                setClient(nextClient);
                setClientTemplateApplied(false);
                if (clients.some((item) => item.name === nextClient)) {
                  applyClientTemplate(nextClient);
                }
              }}
            />
          </label>
          {client && !clientExists && (
            <div className="calendar-new-client-hint">
              <span>Такого клиента нет в базе.</span>
              <button type="button" onClick={() => onCreateClient?.(client)}>
                Добавить клиента
              </button>
            </div>
          )}
          {client && clientExists && clientTemplateApplied && !initialEntry && (
            <p className="calendar-client-template-hint">
              Данные заполнены по предыдущему визиту клиента.
            </p>
          )}
        </>
      )}
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
          <select
            name="master"
            value={master}
            onChange={(event) => setMaster(event.target.value)}>
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
                <option>Укр. карта</option>
                <option>BLIK</option>
                <option>Не указано</option>
              </select>
            </label>
            <label>
              Комиссия
              <select
                name="commissionType"
                value={commissionType}
                onChange={(event) => setCommissionType(event.target.value)}>
                <option>Без комиссии</option>
                <option>Booksy 45%</option>
              </select>
            </label>
            {payment === "Пакет" && (
              <label className="calendar-entry-package-field">
                Пакет клиента
                <select name="packageUsageId" required>
                  <option value="">Выберите пакет</option>
                  {packageOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.packageName} · будет {getPackageProgressLabel(
                        item,
                        getPlannedPackageVisits(item),
                      )}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="calendar-entry-grid calendar-entry-money-grid">
            <label>
              Чай
              <input
                name="tip"
                value={tip}
                onChange={(event) => setTip(event.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Доп сумма
              <input
                name="extra"
                value={extra}
                onChange={(event) => setExtra(event.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Долг
              <input
                name="debt"
                value={debt}
                onChange={(event) => setDebt(event.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Скидка %
              <input
                name="discount"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                placeholder="0"
              />
            </label>
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
        <textarea
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows="2"
        />
      </label>}
      <button className="submit-button">
        {initialEntry || kind !== "visit" ? "Сохранить" : "Добавить в календарь"}
      </button>
    </form>
  );
}

export default CalendarEntryForm;
