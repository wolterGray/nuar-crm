import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {zodResolver} from "@hookform/resolvers/zod";
import {Controller, useForm, useWatch} from "react-hook-form";
import {z} from "zod";
import {getUpcomingBirthday} from "../utils/clientAlerts.js";
import {isActiveClientPackage} from "../utils/clientPackages.js";
import {getActiveCertificatesForClient} from "../utils/certificates.js";
import ClientAutocomplete from "./ClientAutocomplete.jsx";
import {paymentMethods} from "../constants/paymentMethods.js";
import {matchesClientRecord} from "../utils/clientLinks.js";
import {getPackageProgressLabel, isUpcomingPackageVisit} from "../utils/packages.jsx";
import {calculateSiteBookingPrice} from "../utils/siteBookingPricing.js";
import {FieldLabel} from "./HintIcon.jsx";
import {toVisitNumber} from "../utils/visits.jsx";
import {formatMoney, getDaysSinceDisplayDate, toDisplayDate} from "../utils/formatters.jsx";
import {Button, Input, Select, Textarea} from "./ui/index.js";

const DEFAULT_ENTRY_COLOR = "#748091";
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
    cashAmount: optionalMoneyField,
    cardAmount: optionalMoneyField,
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

      if (data.payment === "Наличные + карта") {
        const cashValue = toVisitNumber(data.cashAmount);
        const cardValue = toVisitNumber(data.cardAmount);

        if (cashValue + cardValue <= 0) {
          context.addIssue({
            code: "custom",
            message: "Введите суммы наличных и карты",
            path: ["cashAmount"],
          });
        }
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
  const [creatingClient, setCreatingClient] = useState(false);
  const [insightsNow] = useState(() => new Date());
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
      cashAmount: initialEntry?.cashAmount ?? "",
      cardAmount: initialEntry?.cardAmount ?? "",
      commissionType: initialEntry?.commissionType ?? "Без комиссии",
      tip: initialEntry?.tip ?? "",
      extra: initialEntry?.extra ?? "",
      debt: initialEntry?.debt ?? "",
      discount: initialEntry?.discount ?? "",
      paidAmount: initialEntry?.paidAmount ?? "",
      color: initialEntry?.color ?? DEFAULT_ENTRY_COLOR,
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
    cashAmount,
    cardAmount,
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
      "cashAmount",
      "cardAmount",
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
      durationMinutes: duration,
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
    setFormValue("cashAmount", previousVisit.cashAmount ?? "");
    setFormValue("cardAmount", previousVisit.cardAmount ?? "");
    if (previousVisit.master) {
      setFormValue("master", previousVisit.master);
    }
    skipInitialPricingRef.current = true;
    setClientTemplateApplied(true);
  };
  const handleCreateClientClick = async () => {
    if (!onCreateClient || creatingClient) {
      return;
    }

    const nextClientName = String(client ?? "").trim();
    if (!nextClientName) {
      return;
    }

    setCreatingClient(true);
    try {
      const savedClient = await onCreateClient(nextClientName);
      if (savedClient?.name) {
        setFormValue("client", savedClient.name, { shouldValidate: false });
        applyClientTemplate(savedClient.name);
      }
    } finally {
      setCreatingClient(false);
    }
  };
  const packageOptions = getAvailablePackagesForClient(client);
  const certificateOptions = getActiveCertificatesForClient(
    certificates,
    clients,
    client,
  );
  const isSplitPayment = payment === "Наличные + карта";
  const splitCashAmount = useMemo(() => toVisitNumber(cashAmount), [cashAmount]);
  const splitCardAmount = useMemo(() => toVisitNumber(cardAmount), [cardAmount]);
  const splitPaymentTotal = useMemo(
    () => Math.max(0, splitCashAmount + splitCardAmount),
    [splitCardAmount, splitCashAmount],
  );
  useEffect(() => {
    if (kind !== "visit" || !isSplitPayment) {
      return;
    }

    setFormValue("paidAmount", splitPaymentTotal || "");
  }, [isSplitPayment, kind, setFormValue, splitPaymentTotal]);
  const clientInsights = useMemo(() => {
    if (kind !== "visit" || !clientExists) {
      return null;
    }

    const selectedClient =
      clients.find((item) => item.name === client) ??
      clients.find((item) => matchesClientRecord({client}, clients, item)) ??
      null;
    const activePackages = clientPackages.filter(
      (item) =>
        matchesClientRecord(item, clients, client) &&
        isActiveClientPackage(item),
    );
    const activeCertificates = getActiveCertificatesForClient(
      certificates,
      clients,
      client,
    );
    const clientRecords = [...visits, ...calendarEntries].filter(
      (visit) =>
        visit.kind !== "reserved" &&
        matchesClientRecord(visit, clients, client) &&
        (!initialEntry || visit.id !== initialEntry.id),
    );
    const pastVisits = clientRecords
      .filter((visit) => {
        const timestamp = getVisitTimestamp(visit);

        return (
          Number.isFinite(timestamp) &&
          timestamp < insightsNow.getTime() &&
          !["cancelled", "no_show"].includes(String(visit.status ?? ""))
        );
      })
      .sort((first, second) => getVisitTimestamp(second) - getVisitTimestamp(first));
    const futureVisits = calendarEntries
      .filter((entry) => {
        const timestamp = getVisitTimestamp(entry);

        return (
          entry.kind === "visit" &&
          matchesClientRecord(entry, clients, client) &&
          (!initialEntry || entry.id !== initialEntry.id) &&
          Number.isFinite(timestamp) &&
          timestamp > insightsNow.getTime() &&
          !["completed", "cancelled", "no_show"].includes(String(entry.status ?? ""))
        );
      })
      .sort((first, second) => getVisitTimestamp(first) - getVisitTimestamp(second));
    const lastVisit = pastVisits[0] ?? null;
    const lastVisitDisplay = lastVisit ? toDisplayDate(lastVisit.date) : "";
    const daysSinceLastVisit = lastVisitDisplay
      ? getDaysSinceDisplayDate(lastVisitDisplay)
      : null;
    const birthdayInfo = getUpcomingBirthday(selectedClient?.birthday, insightsNow);

    return {
      activeCertificates,
      activePackages,
      birthdayInfo,
      daysSinceLastVisit,
      futureVisit: futureVisits[0] ?? null,
      hasPhone: Boolean(String(selectedClient?.phone ?? "").trim()),
      lastVisitDisplay,
      selectedClient,
    };
  }, [
    calendarEntries,
    certificates,
    client,
    clientExists,
    clientPackages,
    clients,
    initialEntry,
    insightsNow,
    kind,
    visits,
  ]);
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
      {!initialEntry && (
        <div className="calendar-kind-switch">
          <Button
            className={`calendar-kind-option ${kind === "visit" ? "is-active" : ""}`}
            size="sm"
            type="button"
            variant={kind === "visit" ? "primary" : "ghost"}
            onClick={() => setFormValue("kind", "visit")}
          >
            Клиент
          </Button>
          <Button
            className={`calendar-kind-option ${kind === "reserved" ? "is-active" : ""}`}
            size="sm"
            type="button"
            variant={kind === "reserved" ? "primary" : "ghost"}
            onClick={() => setFormValue("kind", "reserved")}
          >
            Резерв
          </Button>
        </div>
      )}
      <input {...register("kind")} type="hidden" />
      {kind === "visit" && (
        <fieldset className="calendar-client-section calendar-form-section">
          <legend className="calendar-form-legend">Клиент</legend>
          <label className="calendar-form-field">
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
            <div className="flex items-center justify-between calendar-info-card calendar-info-card-error">
              <span className="calendar-info-card-title">Такого клиента нет в базе.</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={creatingClient}
                onClick={handleCreateClientClick}
              >
                {creatingClient ? "Добавляем..." : "Добавить клиента"}
              </Button>
            </div>
          )}
          {client && clientExists && clientTemplateApplied && !initialEntry && (
            <p className="text-2xs font-token-error font-medium px-1">
              Данные заполнены по предыдущему визиту клиента.
            </p>
          )}
          {clientInsights && (
            <div className="grid grid-cols-2 gap-2 mt-1">
              {!clientInsights.hasPhone ? (
                <article className="calendar-info-card calendar-info-card-error">
                  <strong className="block font-bold font-token-error">Нет телефона</strong>
                  <span className="block calendar-info-card-text">SMS-напоминание клиенту не уйдёт.</span>
                </article>
              ) : null}
              {clientInsights.futureVisit ? (
                <article className="calendar-info-card calendar-info-card-error col-span-2">
                  <strong className="block font-bold font-token-error">Уже есть будущая запись</strong>
                  <span className="block calendar-info-card-text">
                    {toDisplayDate(clientInsights.futureVisit.date)} ·{" "}
                    {clientInsights.futureVisit.time} ·{" "}
                    {clientInsights.futureVisit.service || "визит"}
                  </span>
                </article>
              ) : null}
              {clientInsights.daysSinceLastVisit !== null &&
              clientInsights.daysSinceLastVisit >= 45 ? (
                <article className="calendar-info-card">
                  <strong className="block font-bold font-token-error">Вернулся после паузы</strong>
                  <span className="block calendar-info-card-text">
                    Не был {clientInsights.daysSinceLastVisit} дн. · последний визит{" "}
                    {clientInsights.lastVisitDisplay}
                  </span>
                </article>
              ) : null}
              {clientInsights.birthdayInfo?.daysLeft <= 7 ? (
                <article className="calendar-info-card">
                  <strong className="block font-bold font-token-warning">День рождения</strong>
                  <span className="block calendar-info-card-text">
                    {clientInsights.birthdayInfo.label} ·{" "}
                    {clientInsights.birthdayInfo.date}
                  </span>
                </article>
              ) : null}
              {clientInsights.activePackages.length > 0 && payment !== "Пакет" ? (
                <article className="calendar-info-card col-span-2 flex items-center justify-between">
                  <div>
                    <strong className="block font-bold font-token-error">Есть активный пакет</strong>
                    <span className="block calendar-info-card-text">
                      {clientInsights.activePackages[0].packageName || "Пакет"} ·{" "}
                      {clientInsights.activePackages[0].remainingVisits} сеанс. осталось
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setFormValue("payment", "Пакет");
                      setFormValue("packageUsageId", clientInsights.activePackages[0].id);
                    }}
                  >
                    Использовать
                  </Button>
                </article>
              ) : null}
              {clientInsights.activeCertificates.length > 0 &&
              payment !== "Сертификат" ? (
                <article className="calendar-info-card col-span-2 flex items-center justify-between">
                  <div>
                    <strong className="block font-bold font-token-error">Есть сертификат</strong>
                    <span className="block calendar-info-card-text">
                      {clientInsights.activeCertificates[0].code || "Сертификат"} ·{" "}
                      {formatMoney(clientInsights.activeCertificates[0].remainingBalance)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setFormValue("payment", "Сертификат");
                      setFormValue(
                        "certificateUsageId",
                        clientInsights.activeCertificates[0].id,
                      );
                    }}
                  >
                    Использовать
                  </Button>
                </article>
              ) : null}
            </div>
          )}
        </fieldset>
      )}
      <fieldset className="calendar-time-section calendar-form-section">
        <legend className="calendar-form-legend">
          {kind === "visit" ? "Время и мастер" : "Время"}
        </legend>
        <div className="calendar-time-grid grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="calendar-date-field calendar-form-field">
            Дата
            <Input {...register("date")} aria-invalid={Boolean(errors.date)} type="date" className="w-full" />
            <FieldError message={errors.date?.message} />
          </label>
          <label className="calendar-start-field calendar-form-field">
            Время
            <Input
              {...register("time")}
              aria-invalid={Boolean(errors.time)}
              type="time"
              step="900"
              value={time}
              className="w-full"
              onChange={(event) => {
                const nextTime = event.target.value;
                const currentDuration = Math.max(15, toMinutes(endTime) - toMinutes(time));
                setFormValue("time", nextTime);
                setFormValue("endTime", toTime(toMinutes(nextTime) + currentDuration));
              }}
            />
            <FieldError message={errors.time?.message} />
          </label>
          {kind === "visit" ? (
            <label className="calendar-duration-field calendar-form-field">
              Длительность
              <Select
                {...register("duration")}
                aria-invalid={Boolean(errors.duration)}
                value={duration}
                className="w-full"
                onChange={(event) => {
                  const nextDuration = Number(event.target.value);
                  const nextVariant = service?.variants?.find(
                    (variant) => Number(variant.duration) === nextDuration,
                  );
                  allowAutoPricing();
                  setFormValue("duration", String(nextDuration));
                  setFormValue("paidAmount", "");
                  setFormValue("cashAmount", "");
                  setFormValue("cardAmount", "");
                  if (nextVariant) {
                    setFormValue("amount", nextVariant.price);
                  }
                }}
              >
                {durationOptions.map((value) => (
                  <option key={value} value={value}>
                    {value} мин
                  </option>
                ))}
              </Select>
              <FieldError message={errors.duration?.message} />
            </label>
          ) : (
            <label className="calendar-end-field calendar-form-field">
              Конец
              <Input
                {...register("endTime")}
                aria-invalid={Boolean(errors.endTime)}
                type="time"
                step="900"
                value={endTime}
                className="w-full"
                onChange={(event) => setFormValue("endTime", event.target.value)}
              />
              <FieldError message={errors.endTime?.message} />
            </label>
          )}
          <label className="calendar-master-field calendar-form-field">
            Мастер
            <Select
              {...register("master")}
              aria-invalid={Boolean(errors.master)}
              value={master}
              className="w-full"
              onChange={(event) => setFormValue("master", event.target.value)}
            >
              {employees.map((employee) => (
                <option key={employee.id}>{employee.name}</option>
              ))}
            </Select>
            <FieldError message={errors.master?.message} />
          </label>
        </div>
      </fieldset>

      {kind !== "visit" ? (
        <>
          <label className="calendar-reserve-field calendar-form-field">
            Причина
            <Textarea
              {...register("title")}
              aria-invalid={Boolean(errors.title)}
              placeholder="Причина"
              rows="3"
              className="w-full"
            />
            <FieldError message={errors.title?.message} />
          </label>
          <input {...register("color")} type="hidden" value={initialEntry?.color ?? DEFAULT_ENTRY_COLOR} />
        </>
      ) : (
        <>
          <fieldset className="calendar-payment-section calendar-form-section">
            <legend className="calendar-form-legend">Услуга и оплата</legend>
            <div className="calendar-payment-grid grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="calendar-service-field calendar-form-field col-span-2">
                Услуга
                <Select
                  {...register("serviceId")}
                  aria-invalid={Boolean(errors.serviceId)}
                  value={serviceId}
                  className="w-full"
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
                    setFormValue("cashAmount", "");
                    setFormValue("cardAmount", "");
                    setFormValue("amount", nextVariant?.price ?? "");
                  }}
                >
                  <option value="">Выберите услугу</option>
                  {services.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
                <FieldError message={errors.serviceId?.message} />
              </label>
              <label className="calendar-amount-field calendar-form-field">
                <FieldLabel hint="Цена из прайса. Можно изменить вручную.">Стоимость</FieldLabel>
                <Input
                  {...register("amount")}
                  value={amount}
                  className="w-full"
                  onChange={(event) => {
                    markPricingTouched();
                    setFormValue("amount", event.target.value);
                  }}
                  placeholder="0"
                />
              </label>
              <label className="calendar-paid-field calendar-form-field">
                <FieldLabel hint="Фактическая сумма от клиента. Если пусто, считается автоматически по прайсу и скидке.">
                  К оплате
                </FieldLabel>
                <Input
                  {...register("paidAmount")}
                  readOnly={isSplitPayment}
                  value={isSplitPayment ? splitPaymentTotal : paidAmount}
                  className="w-full"
                  onChange={(event) => {
                    markPricingTouched();
                    setFormValue("paidAmount", event.target.value);
                  }}
                  placeholder="авто"
                />
              </label>
              <label className="calendar-payment-method-field calendar-form-field">
                Оплата
                <Select
                  {...register("payment")}
                  aria-invalid={Boolean(errors.payment)}
                  value={payment}
                  className="w-full"
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
                    if (nextPayment === "Наличные + карта") {
                      setFormValue("cashAmount", paidAmount || amount || "");
                      setFormValue("cardAmount", "");
                      setFormValue("paidAmount", paidAmount || amount || "");
                    } else {
                      setFormValue("cashAmount", "");
                      setFormValue("cardAmount", "");
                    }
                  }}
                >
                  {[
                    "Наличные",
                    "Карта",
                    "Наличные + карта",
                    ...paymentMethods.filter(
                      (method) => !["Наличные", "Карта", "Наличные + карта"].includes(method),
                    ),
                  ].map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </Select>
                <FieldError message={errors.payment?.message} />
              </label>
              {isSplitPayment && (
                <>
                  <label className="calendar-form-field">
                    Наличные
                    <Input
                      {...register("cashAmount")}
                      value={cashAmount}
                      className="w-full"
                      onChange={(event) => setFormValue("cashAmount", event.target.value)}
                      placeholder="0"
                    />
                    <FieldError message={errors.cashAmount?.message} />
                  </label>
                  <label className="calendar-form-field">
                    Карта
                    <Input
                      {...register("cardAmount")}
                      value={cardAmount}
                      className="w-full"
                      onChange={(event) => setFormValue("cardAmount", event.target.value)}
                      placeholder="0"
                    />
                    <FieldError message={errors.cardAmount?.message} />
                  </label>
                </>
              )}
              <label className="calendar-commission-field calendar-form-field">
                Комиссия
                <Select
                  {...register("commissionType")}
                  value={commissionType}
                  className="w-full"
                  onChange={(event) => setFormValue("commissionType", event.target.value)}
                >
                  <option>Без комиссии</option>
                  <option>Booksy 45%</option>
                </Select>
              </label>
              {payment === "Пакет" && (
                <label className="calendar-package-field calendar-form-field col-span-2 md:col-span-4">
                  Пакет клиента
                  <Select {...register("packageUsageId")} aria-invalid={Boolean(errors.packageUsageId)} className="w-full">
                    <option value="">Выберите пакет</option>
                    {packageOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.packageName} · будет {getPackageProgressLabel(item, getPlannedPackageVisits(item))}
                      </option>
                    ))}
                  </Select>
                  <FieldError message={errors.packageUsageId?.message} />
                </label>
              )}
              {payment === "Сертификат" && (
                <label className="calendar-certificate-field calendar-form-field col-span-2 md:col-span-4">
                  Сертификат
                  <Select {...register("certificateUsageId")} aria-invalid={Boolean(errors.certificateUsageId)} className="w-full">
                    <option value="">Выберите сертификат</option>
                    {certificateOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} · остаток {item.remainingBalance} zł
                      </option>
                    ))}
                  </Select>
                  <FieldError message={errors.certificateUsageId?.message} />
                </label>
              )}
            </div>
          </fieldset>

          <fieldset className="calendar-extra-section calendar-form-section">
            <legend className="calendar-form-legend">Дополнительно</legend>
            <div className="calendar-extra-grid grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="calendar-form-field">
                Чай
                <Input
                  {...register("tip")}
                  value={tip}
                  className="w-full"
                  onChange={(event) => setFormValue("tip", event.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="calendar-form-field">
                Доп сумма
                <Input
                  {...register("extra")}
                  value={extra}
                  className="w-full"
                  onChange={(event) => setFormValue("extra", event.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="calendar-form-field">
                Долг
                <Input
                  {...register("debt")}
                  value={debt}
                  className="w-full"
                  onChange={(event) => setFormValue("debt", event.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="calendar-form-field">
                Скидка %
                <Input
                  {...register("discount")}
                  value={discount}
                  className="w-full"
                  onChange={(event) => {
                    markPricingTouched();
                    setFormValue("discount", event.target.value);
                  }}
                  placeholder="0"
                />
              </label>
            </div>
            {visitPricing ? (
              <div className="calendar-pricing-card">
                <h4 className="font-bold calendar-info-card-title">Расчёт стоимости</h4>
                <table className="calendar-pricing-table">
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
                    <tr className="calendar-pricing-total">
                      <th className="font-token-error font-bold">К оплате</th>
                      <td className="font-token-error font-bold">{chargedAmount} zł</td>
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
      {kind === "visit" && (
        <label className="calendar-note-field calendar-form-field">
          Комментарий
          <Textarea
            {...register("note")}
            value={note}
            onChange={(event) => setFormValue("note", event.target.value)}
            rows="2"
            className="w-full"
          />
        </label>
      )}
      <div className="calendar-form-actions">
        <Button
          className="calendar-submit-button inline-flex items-center gap-1.5 min-h-[38px] px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all w-full md:w-auto justify-center"
          size="md"
          type="submit"
          variant="primary"
        >
          {initialEntry || kind !== "visit" ? "Сохранить" : "Добавить в календарь"}
        </Button>
      </div>
    </form>
  );

}

function FieldError({message}) {
  if (!message) {
    return null;
  }

  return (
    <small className="calendar-field-error">
      {message}
    </small>
  );
}

export default CalendarEntryForm;
