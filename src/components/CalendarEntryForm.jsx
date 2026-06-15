import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {zodResolver} from "@hookform/resolvers/zod";
import {Controller, useForm, useWatch} from "react-hook-form";
import {z} from "zod";
import {isActiveClientPackage} from "../utils/clientPackages.js";
import {getActiveCertificatesForClient} from "../utils/certificates.js";
import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {paymentMethods} from "../constants/paymentMethods.js";
import {matchesClientRecord} from "../utils/clientLinks.js";
import {getPackageProgressLabel, isUpcomingPackageVisit} from "../utils/packages.jsx";
import {calculateSiteBookingPrice} from "../utils/siteBookingPricing.js";
import {FieldLabel} from "./HintIcon.jsx";
import {toVisitNumber} from "../utils/visits.jsx";

const fallbackColors = ["#4f8edc", "#8b6fd6", "#45a873", "#d78a42", "#c75b78"];
const toMinutes = (time) => {
  const [hours, minutes] = String(time ?? "00:00").split(":").map(Number);
  return hours * 60 + minutes;
};
const toTime = (minutes) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;
const optionalMoneyField = z.union([z.string(), z.number(), z.literal("")]).optional();
const calendarEntrySchema = z
  .object({
    kind: z.enum(["visit", "reserved"]),
    client: z.string().optional(),
    date: z.string().min(1, "Укажите дату"),
    time: z.string().min(1, "Укажите время"),
    endTime: z.string().optional(),
    duration: z.coerce.number().min(15, "Минимум 15 минут"),
    master: z.string().min(1, "Выберите мастера"),
    title: z.string().optional(),
    serviceId: z.union([z.string(), z.number()]).optional(),
    amount: optionalMoneyField,
    payment: z.string().optional(),
    packageUsageId: z.union([z.string(), z.number()]).optional(),
    certificateUsageId: z.union([z.string(), z.number()]).optional(),
    commissionType: z.string().optional(),
    tip: optionalMoneyField,
    extra: optionalMoneyField,
    debt: optionalMoneyField,
    discount: optionalMoneyField,
    paidAmount: optionalMoneyField,
    color: z.string().optional(),
    note: z.string().optional(),
  })
  .superRefine((data, context) => {
    if (data.kind === "visit") {
      if (!String(data.client ?? "").trim()) {
        context.addIssue({
          code: "custom",
          message: "Выберите имя клиента",
          path: ["client"],
        });
      }

      if (!String(data.serviceId ?? "").trim()) {
        context.addIssue({
          code: "custom",
          message: "Выберите услугу",
          path: ["serviceId"],
        });
      }

      if (!String(data.payment ?? "").trim()) {
        context.addIssue({
          code: "custom",
          message: "Выберите оплату",
          path: ["payment"],
        });
      }

      if (data.payment === "Пакет" && !String(data.packageUsageId ?? "").trim()) {
        context.addIssue({
          code: "custom",
          message: "Выберите пакет клиента",
          path: ["packageUsageId"],
        });
      }

      if (
        data.payment === "Сертификат" &&
        !String(data.certificateUsageId ?? "").trim()
      ) {
        context.addIssue({
          code: "custom",
          message: "Выберите сертификат",
          path: ["certificateUsageId"],
        });
      }
    }

    if (data.kind === "reserved") {
      if (!String(data.title ?? "").trim()) {
        context.addIssue({
          code: "custom",
          message: "Укажите причину резерва",
          path: ["title"],
        });
      }

      if (!String(data.endTime ?? "").trim()) {
        context.addIssue({
          code: "custom",
          message: "Укажите время окончания",
          path: ["endTime"],
        });
      } else if (toMinutes(data.endTime) <= toMinutes(data.time)) {
        context.addIssue({
          code: "custom",
          message: "Конец должен быть позже начала",
          path: ["endTime"],
        });
      }
    }
  });

function CalendarEntryForm({
  initialEntry,
  calendarEntries,
  certificates = [],
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
  const [clientTemplateApplied, setClientTemplateApplied] = useState(
    Boolean(initialEntry),
  );
  const skipInitialPricingRef = useRef(Boolean(initialEntry));
  const pricingTouchedRef = useRef(
    Boolean(
      initialEntry &&
        ((initialEntry.paidAmount !== undefined &&
          initialEntry.paidAmount !== null &&
          String(initialEntry.paidAmount).trim() !== "") ||
          (initialEntry.amount !== undefined &&
            initialEntry.amount !== null &&
            String(initialEntry.amount).trim() !== "")),
    ),
  );
  const allowAutoPricing = useCallback(() => {
    pricingTouchedRef.current = false;
  }, []);
  const markPricingTouched = useCallback(() => {
    pricingTouchedRef.current = true;
  }, []);
  const defaultTime = initialEntry?.time ?? selectedTime ?? "10:00";
  const defaultDuration = initialEntry?.duration ?? selectedDuration ?? 60;
  const {
    control,
    formState: {errors},
    handleSubmit,
    register,
    setValue,
  } = useForm({
    defaultValues: {
      kind: initialEntry?.kind ?? selectedKind ?? "visit",
      client: initialEntry?.client ?? selectedClient ?? "",
      date: initialEntry?.date ?? selectedDate,
      time: defaultTime,
      endTime: toTime(toMinutes(defaultTime) + Number(defaultDuration)),
      duration: String(defaultDuration),
      master: initialEntry?.master ?? selectedMaster ?? employees[0]?.name ?? "",
      title: initialEntry?.title ?? "",
      serviceId: initialEntry?.serviceId ?? selectedServiceId ?? "",
      amount: initialEntry?.amount ?? selectedAmount ?? "",
      payment: initialEntry?.payment ?? selectedPayment ?? "Наличные",
      packageUsageId: initialEntry?.packageUsageId ?? "",
      certificateUsageId: initialEntry?.certificateUsageId ?? "",
      commissionType: initialEntry?.commissionType ?? "Без комиссии",
      tip: initialEntry?.tip ?? "",
      extra: initialEntry?.extra ?? "",
      debt: initialEntry?.debt ?? "",
      discount: initialEntry?.discount ?? "",
      paidAmount: initialEntry?.paidAmount ?? "",
      color: initialEntry?.color ?? "#748091",
      note: initialEntry?.note ?? "",
    },
    mode: "onSubmit",
    reValidateMode: "onChange",
    resolver: zodResolver(calendarEntrySchema),
  });
  const setFormValue = useCallback(
    (name, value, options = {}) =>
      setValue(name, value, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
        ...options,
      }),
    [setValue],
  );
  const [
    kind,
    client,
    master,
    serviceId,
    duration,
    time,
    endTime,
    payment,
    amount,
    commissionType,
    date,
    tip,
    extra,
    debt,
    discount,
    paidAmount,
    note,
  ] = useWatch({
    control,
    name: [
      "kind",
      "client",
      "master",
      "serviceId",
      "duration",
      "time",
      "endTime",
      "payment",
      "amount",
      "commissionType",
      "date",
      "tip",
      "extra",
      "debt",
      "discount",
      "paidAmount",
      "note",
    ],
  });
  const service = services.find((item) => String(item.id) === String(serviceId));
  const serviceVariant = useMemo(
    () =>
      service?.variants?.find(
        (variant) => Number(variant.duration) === Number(duration),
      ) ?? null,
    [duration, service],
  );
  const visitPricing = useMemo(() => {
    if (kind !== "visit" || !master || !date || !time || !serviceVariant?.price) {
      return null;
    }

    const employee = employees.find((item) => item.name === master) ?? null;

    return calculateSiteBookingPrice({
      basePrice: serviceVariant.price,
      date,
      employee,
      time,
    });
  }, [date, duration, employees, kind, master, serviceVariant, time]);
  useEffect(() => {
    if (kind !== "visit" || !visitPricing || pricingTouchedRef.current) {
      return;
    }

    if (skipInitialPricingRef.current) {
      skipInitialPricingRef.current = false;
      return;
    }

    const nextAmount = visitPricing.subtotal;
    const nextDiscount = visitPricing.discountPercent;

    if (
      Number(amount) === Number(nextAmount) &&
      Number(discount) === Number(nextDiscount)
    ) {
      return;
    }

    setFormValue("amount", nextAmount, {shouldValidate: false});
    setFormValue("discount", nextDiscount, {shouldValidate: false});
  }, [amount, discount, kind, setFormValue, visitPricing]);
  const chargedAmount = useMemo(() => {
    const paidValue = String(paidAmount ?? "").trim();

    if (paidValue !== "") {
      return Math.max(0, toVisitNumber(paidValue));
    }

    if (visitPricing) {
      return visitPricing.finalPrice;
    }

    const base = toVisitNumber(amount);
    const discountPercent = toVisitNumber(discount);

    return Math.max(0, Math.round(base * (1 - discountPercent / 100)));
  }, [amount, discount, paidAmount, visitPricing]);
  const autoFinalPrice = useMemo(() => {
    if (visitPricing) {
      return visitPricing.finalPrice;
    }

    const base = toVisitNumber(amount);
    const discountPercent = toVisitNumber(discount);

    return Math.max(0, Math.round(base * (1 - discountPercent / 100)));
  }, [amount, discount, visitPricing]);
  const manualDiscountAmount = useMemo(() => {
    if (String(paidAmount ?? "").trim() === "") {
      return 0;
    }

    return Math.max(0, autoFinalPrice - chargedAmount);
  }, [autoFinalPrice, chargedAmount, paidAmount]);
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
          matchesClientRecord(visit, clients, clientName) &&
          (!initialEntry || visit.id !== initialEntry.id),
      )
      .sort((first, second) => getVisitTimestamp(second) - getVisitTimestamp(first))[0];
  const getAvailablePackagesForClient = (clientName) =>
    clientPackages.filter(
      (item) =>
        matchesClientRecord(item, clients, clientName) &&
        isActiveClientPackage(item),
    );
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
    const availablePackages = getAvailablePackagesForClient(clientName);
    const previousPackage = availablePackages.find(
      (item) => String(item.id) === String(previousVisit.packageUsageId),
    );
    const canUsePreviousPackagePayment =
      previousVisit.payment === "Пакет" && availablePackages.length > 0;

    setFormValue("serviceId", previousService?.id ?? previousVisit.serviceId ?? "");
    setFormValue("duration", String(nextDuration));
    setFormValue(
      "amount",
      previousVisit.amount === "" || previousVisit.amount === undefined
        ? nextVariant?.price ?? ""
        : previousVisit.amount,
    );
    setFormValue(
      "payment",
      canUsePreviousPackagePayment
        ? "Пакет"
        : previousVisit.payment === "Пакет"
          ? "Наличные"
          : previousVisit.payment || "Наличные",
    );
    setFormValue(
      "packageUsageId",
      canUsePreviousPackagePayment
        ? previousPackage?.id ?? availablePackages[0]?.id ?? ""
        : "",
    );
    setFormValue("commissionType", previousVisit.commissionType || "Без комиссии");
    setFormValue("tip", previousVisit.tip ?? "");
    setFormValue("extra", previousVisit.extra ?? "");
    setFormValue("debt", "");
    setFormValue("discount", previousVisit.discount ?? "");
    setFormValue("note", previousVisit.note ?? "");
    if (previousVisit.master) {
      setFormValue("master", previousVisit.master);
    }
    skipInitialPricingRef.current = true;
    setClientTemplateApplied(true);
  };
  const packageOptions = getAvailablePackagesForClient(client);
  const certificateOptions = getActiveCertificatesForClient(
    certificates,
    clients,
    client,
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
  const submitForm = (event) => {
    const form = event.currentTarget;
    handleSubmit(() => onSubmit(form))(event);
  };

  return (
    <form className="calendar-entry-form" noValidate onSubmit={submitForm}>
      {!initialEntry && <div className="calendar-kind-switch">
        <button
          className={kind === "visit" ? "active" : ""}
          type="button"
          onClick={() => setFormValue("kind", "visit")}>
          Клиент
        </button>
        <button
          className={kind === "reserved" ? "active" : ""}
          type="button"
          onClick={() => setFormValue("kind", "reserved")}>
          Резерв
        </button>
      </div>}
      <input {...register("kind")} type="hidden" />
      {kind === "visit" && (
        <fieldset className="calendar-form-section">
          <legend>Клиент</legend>
          <label className="calendar-entry-client-field">
            Клиент
            <Controller
              control={control}
              name="client"
              render={({field}) => (
                <ClientAutocomplete
                  clients={clients}
                  id="calendar-client-options"
                  name={field.name}
                  required
                  value={field.value ?? ""}
                  onChange={(event) => {
                    const nextClient = event.target.value;
                    field.onChange(nextClient);
                    setClientTemplateApplied(false);
                    if (clients.some((item) => item.name === nextClient)) {
                      applyClientTemplate(nextClient);
                    }
                  }}
                />
              )}
            />
            <FieldError message={errors.client?.message} />
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
        </fieldset>
      )}
      <fieldset className="calendar-form-section">
        <legend>{kind === "visit" ? "Время и мастер" : "Время"}</legend>
      <div className="calendar-entry-grid calendar-entry-time-grid">
        <label className="calendar-entry-date-field">
          Дата
          <input {...register("date")} aria-invalid={Boolean(errors.date)} type="date" />
          <FieldError message={errors.date?.message} />
        </label>
        <label className="calendar-entry-start-field">
          Время
          <input
            {...register("time")}
            aria-invalid={Boolean(errors.time)}
            type="time"
            step="900"
            value={time}
            onChange={(event) => {
              const nextTime = event.target.value;
              const currentDuration = Math.max(15, toMinutes(endTime) - toMinutes(time));
              setFormValue("time", nextTime);
              setFormValue("endTime", toTime(toMinutes(nextTime) + currentDuration));
            }}
          />
          <FieldError message={errors.time?.message} />
        </label>
        {kind === "visit" ? <label>
          Длительность
          <select
            {...register("duration")}
            aria-invalid={Boolean(errors.duration)}
            value={duration}
            onChange={(event) => {
              const nextDuration = Number(event.target.value);
              const nextVariant = service?.variants?.find(
                (variant) => Number(variant.duration) === nextDuration,
              );
              allowAutoPricing();
              setFormValue("duration", String(nextDuration));
              setFormValue("paidAmount", "");
              if (nextVariant) {
                setFormValue("amount", nextVariant.price);
              }
            }}>
            {durationOptions.map((value) => (
              <option key={value} value={value}>
                {value} мин
              </option>
            ))}
          </select>
          <FieldError message={errors.duration?.message} />
        </label> : <label className="calendar-entry-end-field">
          Конец
          <input
            {...register("endTime")}
            aria-invalid={Boolean(errors.endTime)}
            type="time"
            step="900"
            value={endTime}
            onChange={(event) => setFormValue("endTime", event.target.value)}
          />
          <FieldError message={errors.endTime?.message} />
        </label>}
        <label>
          Мастер
          <select
            {...register("master")}
            aria-invalid={Boolean(errors.master)}
            value={master}
            onChange={(event) => setFormValue("master", event.target.value)}>
            {employees.map((employee) => (
              <option key={employee.id}>{employee.name}</option>
            ))}
          </select>
          <FieldError message={errors.master?.message} />
        </label>
      </div>
      </fieldset>

      {kind !== "visit" ? (
        <>
          <label>
            Причина
            <textarea
              {...register("title")}
              aria-invalid={Boolean(errors.title)}
              placeholder="Причина"
              rows="3"
            />
            <FieldError message={errors.title?.message} />
          </label>
          <input {...register("color")} type="hidden" value={initialEntry?.color ?? "#748091"} />
        </>
      ) : (
        <>
          <fieldset className="calendar-form-section">
            <legend>Услуга и оплата</legend>
          <div className="calendar-entry-grid calendar-entry-service-grid">
            <label className="calendar-entry-service-field">
              Услуга
              <select
                {...register("serviceId")}
                aria-invalid={Boolean(errors.serviceId)}
                value={serviceId}
                onChange={(event) => {
                  const nextService = services.find(
                    (item) => String(item.id) === String(event.target.value),
                  );
                  const nextVariant = nextService?.variants?.find(
                    (variant) => Number(variant.duration) === Number(duration),
                  );
                  allowAutoPricing();
                  setFormValue("serviceId", event.target.value);
                  setFormValue("paidAmount", "");
                  setFormValue("amount", nextVariant?.price ?? "");
                }}>
                <option value="">Выберите услугу</option>
                {services.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <FieldError message={errors.serviceId?.message} />
            </label>
            <label>
              <FieldLabel hint="Цена из прайса. Можно изменить вручную.">
                Стоимость
              </FieldLabel>
              <input
                {...register("amount")}
                value={amount}
                onChange={(event) => {
                  markPricingTouched();
                  setFormValue("amount", event.target.value);
                }}
                placeholder="0"
              />
            </label>
            <label>
              <FieldLabel hint="Фактическая сумма от клиента. Если пусто, считается автоматически по прайсу и скидке.">
                К оплате
              </FieldLabel>
              <input
                {...register("paidAmount")}
                value={paidAmount}
                onChange={(event) => {
                  markPricingTouched();
                  setFormValue("paidAmount", event.target.value);
                }}
                placeholder="авто"
              />
            </label>
            <label>
              Оплата
              <select
                {...register("payment")}
                aria-invalid={Boolean(errors.payment)}
                value={payment}
                onChange={(event) => {
                  const nextPayment = event.target.value;
                  setFormValue("payment", nextPayment);
                  if (nextPayment !== "Пакет") {
                    setFormValue("packageUsageId", "");
                  } else if (packageOptions.length === 1) {
                    setFormValue("packageUsageId", packageOptions[0].id);
                  }
                  if (nextPayment !== "Сертификат") {
                    setFormValue("certificateUsageId", "");
                  } else if (certificateOptions.length === 1) {
                    setFormValue("certificateUsageId", certificateOptions[0].id);
                  }
                }}>
                {paymentMethods.map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
              <FieldError message={errors.payment?.message} />
            </label>
            <label>
              Комиссия
              <select
                {...register("commissionType")}
                value={commissionType}
                onChange={(event) => setFormValue("commissionType", event.target.value)}>
                <option>Без комиссии</option>
                <option>Booksy 45%</option>
              </select>
            </label>
            {payment === "Пакет" && (
              <label className="calendar-entry-package-field">
                Пакет клиента
                <select
                  {...register("packageUsageId")}
                  aria-invalid={Boolean(errors.packageUsageId)}>
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
                <FieldError message={errors.packageUsageId?.message} />
              </label>
            )}
            {payment === "Сертификат" && (
              <label className="calendar-entry-package-field">
                Сертификат
                <select
                  {...register("certificateUsageId")}
                  aria-invalid={Boolean(errors.certificateUsageId)}>
                  <option value="">Выберите сертификат</option>
                  {certificateOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · остаток {item.remainingBalance} zł
                    </option>
                  ))}
                </select>
                <FieldError message={errors.certificateUsageId?.message} />
              </label>
            )}
          </div>
          </fieldset>
          <fieldset className="calendar-form-section">
            <legend>Дополнительно</legend>
          <div className="calendar-entry-grid calendar-entry-money-grid">
            <label>
              Чай
              <input
                {...register("tip")}
                value={tip}
                onChange={(event) => setFormValue("tip", event.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Доп сумма
              <input
                {...register("extra")}
                value={extra}
                onChange={(event) => setFormValue("extra", event.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Долг
              <input
                {...register("debt")}
                value={debt}
                onChange={(event) => setFormValue("debt", event.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              Скидка %
              <input
                {...register("discount")}
                value={discount}
                onChange={(event) => {
                  markPricingTouched();
                  setFormValue("discount", event.target.value);
                }}
                placeholder="0"
              />
            </label>
          </div>
          {visitPricing ? (
            <div className="visit-pricing-table">
              <h4>Расчёт стоимости</h4>
              <table>
                <tbody>
                  <tr>
                    <th>Базовая цена</th>
                    <td>{visitPricing.basePrice} zł</td>
                  </tr>
                  {visitPricing.premiumPercent > 0 ? (
                    <tr>
                      <th>Премиум +{visitPricing.premiumPercent}%</th>
                      <td>+{visitPricing.premiumAmount} zł</td>
                    </tr>
                  ) : null}
                  <tr>
                    <th>Сумма до скидки</th>
                    <td>{visitPricing.subtotal} zł</td>
                  </tr>
                  {visitPricing.discountPercent > 0 ? (
                    <tr>
                      <th>Скидка −{visitPricing.discountPercent}%</th>
                      <td>−{visitPricing.discountAmount} zł</td>
                    </tr>
                  ) : null}
                  {manualDiscountAmount > 0 ? (
                    <tr>
                      <th>Индивидуальная скидка</th>
                      <td>−{manualDiscountAmount} zł</td>
                    </tr>
                  ) : null}
                  <tr className="visit-pricing-total">
                    <th>К оплате</th>
                    <td>{chargedAmount} zł</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
          </fieldset>
          <input
            {...register("color")}
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
          {...register("note")}
          value={note}
          onChange={(event) => setFormValue("note", event.target.value)}
          rows="2"
        />
      </label>}
      <div className="calendar-entry-form-footer">
        <button className="submit-button" type="submit">
          {initialEntry || kind !== "visit" ? "Сохранить" : "Добавить в календарь"}
        </button>
      </div>
    </form>
  );
}

function FieldError({message}) {
  if (!message) {
    return null;
  }

  return (
    <small className="field-error">
      {message}
    </small>
  );
}

export default CalendarEntryForm;
