import {parsePhoneNumberFromString} from "https://esm.sh/libphonenumber-js@1.12.9";

export function validateStoredPhoneDigits(digits: unknown) {
  const cleaned = String(digits ?? "").replace(/\D/g, "");

  if (!cleaned) {
    return {ok: false as const, error: "empty"};
  }

  const parsed = parsePhoneNumberFromString(`+${cleaned}`);

  if (!parsed?.isValid()) {
    return {ok: false as const, error: "invalid"};
  }

  return {
    ok: true as const,
    e164: parsed.number.slice(1),
    country: parsed.country ?? "",
  };
}

export function validateSiteBookingPhoneInput(
  country: unknown,
  localNumber: unknown,
) {
  const countryCode = String(country ?? "").trim().toUpperCase();
  const raw = String(localNumber ?? "").trim();

  if (!countryCode) {
    return {ok: false as const, error: "no_country"};
  }

  if (!raw) {
    return {ok: false as const, error: "empty"};
  }

  if (raw.startsWith("+")) {
    const international = parsePhoneNumberFromString(raw);

    if (international?.isValid()) {
      return {
        ok: true as const,
        e164: international.number.slice(1),
        country: international.country ?? countryCode,
      };
    }

    return {ok: false as const, error: "invalid"};
  }

  const digitsOnly = raw.replace(/\D/g, "");

  if (digitsOnly.length > 10) {
    const international = parsePhoneNumberFromString(`+${digitsOnly}`);

    if (international?.isValid()) {
      return {
        ok: true as const,
        e164: international.number.slice(1),
        country: international.country ?? countryCode,
      };
    }
  }

  const parsed = parsePhoneNumberFromString(raw, countryCode as never);

  if (!parsed?.isValid()) {
    return {ok: false as const, error: "invalid"};
  }

  return {
    ok: true as const,
    e164: parsed.number.slice(1),
    country: parsed.country ?? countryCode,
  };
}
