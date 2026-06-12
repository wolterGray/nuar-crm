import type {ParsedBooksyEvent} from "./booksyParser.ts";

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizePhone = (value: unknown) => String(value ?? "").replace(/\D/g, "");

const timeToMinutes = (time = "") => {
  const [hours = 0, minutes = 0] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
};

const scoreField = (condition: boolean, weight: number) => (condition ? weight : 0);

export const classifyReviewKind = (
  extracted: ParsedBooksyEvent,
  bestMatchScore = 0,
) => {
  if (extracted.missing_fields?.length >= 3 || extracted.confidence_score < 40) {
    return "needs_review";
  }

  if (extracted.status === "cancelled") {
    return bestMatchScore >= 60 ? "visit_cancel" : "needs_review";
  }

  if (extracted.status === "changed") {
    return bestMatchScore >= 60 ? "visit_update" : "needs_review";
  }

  if (bestMatchScore >= 60) {
    return "possible_duplicate";
  }

  return "new_visit";
};

export const matchExtractedEventToCalendar = (
  extracted: ParsedBooksyEvent,
  calendarEntries: Array<Record<string, unknown>> = [],
  clients: Array<Record<string, unknown>> = [],
) => {
  const candidates = calendarEntries
    .filter((entry) => entry.kind === "visit")
    .map((entry) => {
      let score = 0;
      const reasons: string[] = [];

      score += scoreField(entry.date === extracted.appointment_date, 24);
      if (entry.date === extracted.appointment_date) reasons.push("date");

      const timeDiff = Math.abs(
        timeToMinutes(String(entry.time ?? "")) -
          timeToMinutes(String(extracted.start_time ?? "")),
      );
      if (timeDiff === 0) {
        score += 20;
        reasons.push("time");
      } else if (timeDiff <= 15) {
        score += 12;
        reasons.push("time_near");
      }

      score += scoreField(
        normalizeText(entry.client) === normalizeText(extracted.client_name),
        18,
      );
      if (normalizeText(entry.client) === normalizeText(extracted.client_name)) {
        reasons.push("client_name");
      }

      const client = clients.find((item) => item.id === entry.clientId);
      if (
        extracted.client_phone &&
        normalizePhone(client?.phone) === normalizePhone(extracted.client_phone)
      ) {
        score += 14;
        reasons.push("phone");
      }

      if (
        extracted.client_email &&
        normalizeText(client?.email) === normalizeText(extracted.client_email)
      ) {
        score += 10;
        reasons.push("email");
      }

      score += scoreField(
        normalizeText(entry.master) === normalizeText(extracted.staff_name),
        12,
      );
      if (normalizeText(entry.master) === normalizeText(extracted.staff_name)) {
        reasons.push("master");
      }

      score += scoreField(
        normalizeText(entry.service) === normalizeText(extracted.service_name),
        12,
      );
      if (normalizeText(entry.service) === normalizeText(extracted.service_name)) {
        reasons.push("service");
      }

      score += scoreField(
        Number(entry.duration) === Number(extracted.duration_minutes),
        8,
      );
      if (Number(entry.duration) === Number(extracted.duration_minutes)) {
        reasons.push("duration");
      }

      return {
        calendar_entry_id: String(entry.id ?? ""),
        match_score: Math.min(100, score),
        match_reason: reasons.join(", "),
        entry,
      };
    })
    .filter((candidate) => candidate.match_score >= 40)
    .sort((left, right) => right.match_score - left.match_score);

  const best = candidates[0] ?? null;

  return {
    bestMatch: best,
    candidates: candidates.slice(0, 5),
    reviewKind: classifyReviewKind(extracted, best?.match_score ?? 0),
  };
};
