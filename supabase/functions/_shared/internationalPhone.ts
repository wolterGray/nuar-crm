import {parsePhoneNumberFromString} from "https://esm.sh/libphonenumber-js@1.12.9";

export function validateInternationalPhoneValue(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return {ok: false as const, error: "empty"};
  }

  if (!raw.startsWith("+")) {
    return {ok: false as const, error: "missing_plus"};
  }

  const parsed = parsePhoneNumberFromString(raw);

  if (!parsed?.isValid()) {
    return {ok: false as const, error: "invalid"};
  }

  return {
    ok: true as const,
    e164: parsed.number,
    country: parsed.country ?? "",
  };
}

/** @deprecated Legacy split country + local fields */
export function validateStoredPhoneDigits(digits: unknown) {
  const cleaned = String(digits ?? "").replace(/\D/g, "");

  if (!cleaned) {
    return {ok: false as const, error: "empty"};
  }

  return validateInternationalPhoneValue(`+${cleaned}`);
}

/** @deprecated Legacy split country + local fields */
export function validateSiteBookingPhoneInput(
  country: unknown,
  localNumber: unknown,
) {
  const raw = String(localNumber ?? "").trim();

  if (raw.startsWith("+")) {
    return validateInternationalPhoneValue(raw);
  }

  const countryCode = String(country ?? "").trim().toUpperCase();

  if (!countryCode || !raw) {
    return {ok: false as const, error: "invalid"};
  }

  const parsed = parsePhoneNumberFromString(raw, countryCode as never);

  if (!parsed?.isValid()) {
    return {ok: false as const, error: "invalid"};
  }

  return {
    ok: true as const,
    e164: parsed.number,
    country: parsed.country ?? countryCode,
  };
}
