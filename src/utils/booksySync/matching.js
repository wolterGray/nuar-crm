import {normalizeBooksyText} from "./booksyGmailParser.js";

const normalizePhone = (value) => String(value ?? "").replace(/\D/g, "");

const normalizeName = (value) => normalizeBooksyText(value);

const timeToMinutes = (time = "") => {
  const [hours = 0, minutes = 0] = String(time).split(":").map(Number);
  return hours * 60 + minutes;
};

const scoreField = (condition, weight) => (condition ? weight : 0);

export const classifyReviewKind = (extracted, bestMatchScore = 0) => {
  if (extracted.missing_fields?.length >= 3 || extracted.confidence_score < 40) {
    return "needs_review";
  }

  if (extracted.status === "cancelled") {
    return bestMatchScore >= 60 ? "visit_cancel" : "needs_review";
  }

  if (extracted.status === "changed") {
    return bestMatchScore >= 60 ? "visit_update" : "needs_review";
  }

  if (bestMatchScore >= 90) {
    return "possible_duplicate";
  }

  if (bestMatchScore >= 60) {
    return "possible_duplicate";
  }

  return "new_visit";
};

export const reviewKindLabel = (kind) => {
  switch (kind) {
    case "new_visit":
      return "Найден новый визит";
    case "possible_duplicate":
      return "Возможно, дубликат";
    case "visit_update":
      return "Изменение визита";
    case "visit_cancel":
      return "Отмена визита";
    case "needs_review":
      return "Нужна проверка";
    case "parse_error":
      return "Ошибка парсинга";
    default:
      return kind;
  }
};

export const matchExtractedEventToCalendar = (
  extracted,
  calendarEntries = [],
  clients = [],
) => {
  const candidates = calendarEntries
    .filter((entry) => entry.kind === "visit")
    .map((entry) => {
      let score = 0;
      const reasons = [];

      score += scoreField(entry.date === extracted.appointment_date, 24);
      if (entry.date === extracted.appointment_date) reasons.push("date");

      const timeDiff = Math.abs(
        timeToMinutes(entry.time) - timeToMinutes(extracted.start_time),
      );
      if (timeDiff === 0) {
        score += 20;
        reasons.push("time");
      } else if (timeDiff <= 15) {
        score += 12;
        reasons.push("time_near");
      }

      score += scoreField(
        normalizeName(entry.client) === normalizeName(extracted.client_name),
        18,
      );
      if (normalizeName(entry.client) === normalizeName(extracted.client_name)) {
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
        normalizeName(client?.email) === normalizeName(extracted.client_email)
      ) {
        score += 10;
        reasons.push("email");
      }

      score += scoreField(
        normalizeName(entry.master) === normalizeName(extracted.staff_name),
        12,
      );
      if (normalizeName(entry.master) === normalizeName(extracted.staff_name)) {
        reasons.push("master");
      }

      score += scoreField(
        normalizeName(entry.service) === normalizeName(extracted.service_name),
        12,
      );
      if (normalizeName(entry.service) === normalizeName(extracted.service_name)) {
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
        calendar_entry_id: entry.id,
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
    autoApplyAllowed:
      (extracted.confidence_score >= 90 && (best?.match_score ?? 0) < 60) ||
      ((best?.match_score ?? 0) >= 90 &&
        ["visit_update", "visit_cancel"].includes(
          classifyReviewKind(extracted, best.match_score),
        )),
  };
};

export const buildReviewSummary = (events = []) => ({
  total: events.length,
  newVisits: events.filter((item) => item.review_kind === "new_visit").length,
  duplicates: events.filter((item) => item.review_kind === "possible_duplicate")
    .length,
  updates: events.filter((item) => item.review_kind === "visit_update").length,
  cancellations: events.filter((item) => item.review_kind === "visit_cancel").length,
  needsReview: events.filter((item) => item.review_kind === "needs_review").length,
});
