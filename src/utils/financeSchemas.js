import {z} from "zod";

const nullableString = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => String(value ?? "").trim());

const amountLike = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value) => {
    const normalizedValue =
      typeof value === "string"
        ? value.replace(/\s+/g, "").replace(",", ".")
        : value;
    const number = Number(normalizedValue);

    return Number.isFinite(number) ? number : 0;
  });

const baseFinanceObject = {
  amount: amountLike.default(0),
  client: nullableString.default(""),
  commission: amountLike.default(0),
  commissionType: nullableString.default("Без комиссии"),
  date: nullableString.default(""),
  debt: amountLike.default(0),
  discount: amountLike.default(0),
  extra: amountLike.default(0),
  master: nullableString.default(""),
  note: nullableString.default(""),
  paidAmount: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
  payment: nullableString.default("Не указано"),
  recordType: nullableString.default(""),
  service: nullableString.default(""),
  status: nullableString.default(""),
  time: nullableString.default(""),
  tip: amountLike.default(0),
};

export const visitSchema = z.object(baseFinanceObject).passthrough();

export const paymentSchema = z.object(baseFinanceObject).passthrough();

export const expenseSchema = z
  .object({
    ...baseFinanceObject,
    recordType: nullableString.default("operation"),
  })
  .passthrough();

export const packageSchema = z
  .object({
    client: nullableString.default(""),
    master: nullableString.default(""),
    payment: nullableString.default("Не указано"),
    price: amountLike.default(0),
    purchaseDate: nullableString.default(""),
  })
  .passthrough();

export const certificateSchema = z
  .object({
    client: nullableString.default(""),
    code: nullableString.default(""),
    expiryDate: nullableString.default(""),
    master: nullableString.default(""),
    nominal: amountLike.default(0),
    payment: nullableString.default("Не указано"),
    purchaseDate: nullableString.default(""),
    recipient: nullableString.default(""),
    remainingBalance: amountLike.default(0),
    saleVisitId: z.union([z.string(), z.number(), z.null(), z.undefined()]).optional(),
    status: nullableString.default("Активен"),
  })
  .passthrough();

export const safeVisit = (visit) => visitSchema.safeParse(visit).data ?? visit;

export const safePackage = (clientPackage) =>
  packageSchema.safeParse(clientPackage).data ?? clientPackage;

export const safeCertificate = (certificate) =>
  certificateSchema.safeParse(certificate).data ?? certificate;
