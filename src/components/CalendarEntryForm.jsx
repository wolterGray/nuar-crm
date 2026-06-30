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
  }, [date, employees, kind, master, serviceVariant, time]);
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
    <form className="calendar-entry-form flex flex-col gap-4 text-zinc-200" noValidate onSubmit={submitForm}>
      {!initialEntry && (
        <div className="calendar-kind-switch flex rounded-lg bg-zinc-900 p-0.5 border border-zinc-800 w-full">
          <button
            className={`flex-1 py-1.5 text-xs font-semibold text-center rounded-md cursor-pointer transition-all ${
              kind === "visit"
                ? "is-active text-white shadow-xs font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            type="button"
            onClick={() => setFormValue("kind", "visit")}
          >
            Клиент
          </button>
          <button
            className={`flex-1 py-1.5 text-xs font-semibold text-center rounded-md cursor-pointer transition-all ${
              kind === "reserved"
                ? "is-active text-white shadow-xs font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            type="button"
            onClick={() => setFormValue("kind", "reserved")}
          >
            Резерв
          </button>
        </div>
      )}
      <input {...register("kind")} type="hidden" />
      {kind === "visit" && (
        <fieldset className="calendar-client-section flex flex-col gap-3 p-4 border border-zinc-800/80 rounded-xl bg-zinc-900/10">
          <legend className="text-2xs font-bold uppercase tracking-wider text-zinc-500 px-2">Клиент</legend>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
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
            <div className="flex items-center justify-between p-3 border border-red-800/30 rounded-xl bg-red-950/10 text-xs">
              <span className="text-zinc-300">Такого клиента нет в базе.</span>
              <button
                type="button"
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-lg font-semibold text-zinc-250 cursor-pointer"
                onClick={() => onCreateClient?.(client)}
              >
                Добавить клиента
              </button>
            </div>
          )}
          {client && clientExists && clientTemplateApplied && !initialEntry && (
            <p className="text-2xs text-red-300 font-medium px-1">
              Данные заполнены по предыдущему визиту клиента.
            </p>
          )}
          {clientInsights && (
            <div className="grid grid-cols-2 gap-2 mt-1">
              {!clientInsights.hasPhone ? (
                <article className="p-3 border border-red-800/30 rounded-xl bg-red-950/10 text-xs">
                  <strong className="block font-bold text-red-300">Нет телефона</strong>
                  <span className="block text-zinc-400 text-2xs mt-0.5">SMS-напоминание клиенту не уйдёт.</span>
                </article>
              ) : null}
              {clientInsights.futureVisit ? (
                <article className="p-3 border border-red-800/30 rounded-xl bg-red-950/10 text-xs col-span-2">
                  <strong className="block font-bold text-red-300">Уже есть будущая запись</strong>
                  <span className="block text-zinc-400 text-2xs mt-0.5">
                    {toDisplayDate(clientInsights.futureVisit.date)} ·{" "}
                    {clientInsights.futureVisit.time} ·{" "}
                    {clientInsights.futureVisit.service || "визит"}
                  </span>
                </article>
              ) : null}
              {clientInsights.daysSinceLastVisit !== null &&
              clientInsights.daysSinceLastVisit >= 45 ? (
                <article className="p-3 border border-zinc-800 rounded-xl bg-zinc-900/30 text-xs">
                  <strong className="block font-bold text-red-300">Вернулся после паузы</strong>
                  <span className="block text-zinc-400 text-2xs mt-0.5">
                    Не был {clientInsights.daysSinceLastVisit} дн. · последний визит{" "}
                    {clientInsights.lastVisitDisplay}
                  </span>
                </article>
              ) : null}
              {clientInsights.birthdayInfo?.daysLeft <= 7 ? (
                <article className="p-3 border border-zinc-800 rounded-xl bg-zinc-900/30 text-xs">
                  <strong className="block font-bold text-pink-400">День рождения</strong>
                  <span className="block text-zinc-400 text-2xs mt-0.5">
                    {clientInsights.birthdayInfo.label} ·{" "}
                    {clientInsights.birthdayInfo.date}
                  </span>
                </article>
              ) : null}
              {clientInsights.activePackages.length > 0 && payment !== "Пакет" ? (
                <article className="p-3 border border-zinc-800 rounded-xl bg-zinc-900/30 text-xs col-span-2 flex items-center justify-between">
                  <div>
                    <strong className="block font-bold text-red-300">Есть активный пакет</strong>
                    <span className="block text-zinc-400 text-2xs mt-0.5">
                      {clientInsights.activePackages[0].packageName || "Пакет"} ·{" "}
                      {clientInsights.activePackages[0].remainingVisits} сеанс. осталось
                    </span>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-2xs font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                    onClick={() => {
                      setFormValue("payment", "Пакет");
                      setFormValue("packageUsageId", clientInsights.activePackages[0].id);
                    }}
                  >
                    Использовать
                  </button>
                </article>
              ) : null}
              {clientInsights.activeCertificates.length > 0 &&
              payment !== "Сертификат" ? (
                <article className="p-3 border border-zinc-800 rounded-xl bg-zinc-900/30 text-xs col-span-2 flex items-center justify-between">
                  <div>
                    <strong className="block font-bold text-red-300">Есть сертификат</strong>
                    <span className="block text-zinc-400 text-2xs mt-0.5">
                      {clientInsights.activeCertificates[0].code || "Сертификат"} ·{" "}
                      {formatMoney(clientInsights.activeCertificates[0].remainingBalance)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-2xs font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                    onClick={() => {
                      setFormValue("payment", "Сертификат");
                      setFormValue(
                        "certificateUsageId",
                        clientInsights.activeCertificates[0].id,
                      );
                    }}
                  >
                    Использовать
                  </button>
                </article>
              ) : null}
            </div>
          )}
        </fieldset>
      )}
      <fieldset className="calendar-time-section flex flex-col gap-3 p-4 border border-zinc-800/80 rounded-xl bg-zinc-900/10">
        <legend className="text-2xs font-bold uppercase tracking-wider text-zinc-500 px-2">
          {kind === "visit" ? "Время и мастер" : "Время"}
        </legend>
        <div className="calendar-time-grid grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="calendar-date-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
            Дата
            <input {...register("date")} aria-invalid={Boolean(errors.date)} type="date" className="w-full" />
            <FieldError message={errors.date?.message} />
          </label>
          <label className="calendar-start-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
            Время
            <input
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
            <label className="calendar-duration-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
              Длительность
              <select
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
              </select>
              <FieldError message={errors.duration?.message} />
            </label>
          ) : (
            <label className="calendar-end-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
              Конец
              <input
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
          <label className="calendar-master-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
            Мастер
            <select
              {...register("master")}
              aria-invalid={Boolean(errors.master)}
              value={master}
              className="w-full"
              onChange={(event) => setFormValue("master", event.target.value)}
            >
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
          <label className="calendar-reserve-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
            Причина
            <textarea
              {...register("title")}
              aria-invalid={Boolean(errors.title)}
              placeholder="Причина"
              rows="3"
              className="w-full"
            />
            <FieldError message={errors.title?.message} />
          </label>
          <input {...register("color")} type="hidden" value={initialEntry?.color ?? "#748091"} />
        </>
      ) : (
        <>
          <fieldset className="calendar-payment-section flex flex-col gap-3 p-4 border border-zinc-800/80 rounded-xl bg-zinc-900/10">
            <legend className="text-2xs font-bold uppercase tracking-wider text-zinc-500 px-2">Услуга и оплата</legend>
            <div className="calendar-payment-grid grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="calendar-service-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400 col-span-2">
                Услуга
                <select
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
                    setFormValue("amount", nextVariant?.price ?? "");
                  }}
                >
                  <option value="">Выберите услугу</option>
                  {services.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <FieldError message={errors.serviceId?.message} />
              </label>
              <label className="calendar-amount-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
                <FieldLabel hint="Цена из прайса. Можно изменить вручную.">Стоимость</FieldLabel>
                <input
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
              <label className="calendar-paid-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
                <FieldLabel hint="Фактическая сумма от клиента. Если пусто, считается автоматически по прайсу и скидке.">
                  К оплате
                </FieldLabel>
                <input
                  {...register("paidAmount")}
                  value={paidAmount}
                  className="w-full"
                  onChange={(event) => {
                    markPricingTouched();
                    setFormValue("paidAmount", event.target.value);
                  }}
                  placeholder="авто"
                />
              </label>
              <label className="calendar-payment-method-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
                Оплата
                <select
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
                  }}
                >
                  {paymentMethods.map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </select>
                <FieldError message={errors.payment?.message} />
              </label>
              <label className="calendar-commission-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
                Комиссия
                <select
                  {...register("commissionType")}
                  value={commissionType}
                  className="w-full"
                  onChange={(event) => setFormValue("commissionType", event.target.value)}
                >
                  <option>Без комиссии</option>
                  <option>Booksy 45%</option>
                </select>
              </label>
              {payment === "Пакет" && (
                <label className="calendar-package-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400 col-span-2 md:col-span-4">
                  Пакет клиента
                  <select {...register("packageUsageId")} aria-invalid={Boolean(errors.packageUsageId)} className="w-full">
                    <option value="">Выберите пакет</option>
                    {packageOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.packageName} · будет {getPackageProgressLabel(item, getPlannedPackageVisits(item))}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.packageUsageId?.message} />
                </label>
              )}
              {payment === "Сертификат" && (
                <label className="calendar-certificate-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400 col-span-2 md:col-span-4">
                  Сертификат
                  <select {...register("certificateUsageId")} aria-invalid={Boolean(errors.certificateUsageId)} className="w-full">
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

          <fieldset className="calendar-extra-section flex flex-col gap-3 p-4 border border-zinc-800/80 rounded-xl bg-zinc-900/10">
            <legend className="text-2xs font-bold uppercase tracking-wider text-zinc-500 px-2">Дополнительно</legend>
            <div className="calendar-extra-grid grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
                Чай
                <input
                  {...register("tip")}
                  value={tip}
                  className="w-full"
                  onChange={(event) => setFormValue("tip", event.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
                Доп сумма
                <input
                  {...register("extra")}
                  value={extra}
                  className="w-full"
                  onChange={(event) => setFormValue("extra", event.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
                Долг
                <input
                  {...register("debt")}
                  value={debt}
                  className="w-full"
                  onChange={(event) => setFormValue("debt", event.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
                Скидка %
                <input
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
              <div className="mt-3 p-4 border border-zinc-800 rounded-xl bg-zinc-900/30 text-xs flex flex-col gap-2">
                <h4 className="font-bold text-zinc-300">Расчёт стоимости</h4>
                <table className="w-full text-left border-collapse">
                  <tbody>
                    <tr className="border-b border-zinc-800/60 h-8">
                      <th className="font-medium text-zinc-400">Базовая цена</th>
                      <td className="text-right text-zinc-200">{visitPricing.basePrice} zł</td>
                    </tr>
                    {visitPricing.premiumPercent > 0 ? (
                      <tr className="border-b border-zinc-800/60 h-8">
                        <th className="font-medium text-zinc-400">Премиум +{visitPricing.premiumPercent}%</th>
                        <td className="text-right text-zinc-200">+{visitPricing.premiumAmount} zł</td>
                      </tr>
                    ) : null}
                    <tr className="border-b border-zinc-800/60 h-8">
                      <th className="font-medium text-zinc-400">Сумма до скидки</th>
                      <td className="text-right text-zinc-200">{visitPricing.subtotal} zł</td>
                    </tr>
                    {visitPricing.discountPercent > 0 ? (
                      <tr className="border-b border-zinc-800/60 h-8">
                        <th className="font-medium text-zinc-400">Скидка −{visitPricing.discountPercent}%</th>
                        <td className="text-right text-zinc-200">−{visitPricing.discountAmount} zł</td>
                      </tr>
                    ) : null}
                    {manualDiscountAmount > 0 ? (
                      <tr className="border-b border-zinc-800/60 h-8">
                        <th className="font-medium text-zinc-400">Индивидуальная скидка</th>
                        <td className="text-right text-zinc-200">−{manualDiscountAmount} zł</td>
                      </tr>
                    ) : null}
                    <tr className="h-9 font-bold text-zinc-150">
                      <th className="text-red-300 font-bold">К оплате</th>
                      <td className="text-right text-red-300 font-bold">{chargedAmount} zł</td>
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
        <label className="calendar-note-field flex flex-col gap-1.5 text-xs font-semibold text-zinc-400">
          Комментарий
          <textarea
            {...register("note")}
            value={note}
            onChange={(event) => setFormValue("note", event.target.value)}
            rows="2"
            className="w-full"
          />
        </label>
      )}
      <div className="calendar-form-actions flex justify-end gap-2 mt-2 pt-4 border-t border-zinc-800/60">
        <button
          className="calendar-submit-button inline-flex items-center gap-1.5 min-h-[38px] px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all w-full md:w-auto justify-center"
          type="submit"
        >
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
    <small className="text-red-400 text-[10px] font-semibold mt-1">
      {message}
    </small>
  );
}

export default CalendarEntryForm;
