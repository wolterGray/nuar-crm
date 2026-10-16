import {describe, expect, it} from "vitest";
import {
  buildClientContext,
  DYNAMIC_VARIABLES,
  findClientAppointments,
  normalizeTemplate,
  normalizeTemplateList,
  NUAR_STARTER_TEMPLATES,
  substituteVariables,
  TEMPLATE_CATEGORIES,
  TEMPLATE_LANGUAGES,
} from "./templateManager.js";

describe("templateManager", () => {
  it("defines standard categories, languages and dynamic variables", () => {
    expect(TEMPLATE_CATEGORIES.length).toBe(8);
    expect(TEMPLATE_LANGUAGES.map((l) => l.code)).toEqual(["pl", "ru", "ua", "en"]);
    expect(DYNAMIC_VARIABLES.some((v) => v.key === "{client_name}")).toBe(true);
    expect(DYNAMIC_VARIABLES.some((v) => v.key === "{studio_address}")).toBe(true);
  });

  it("substitutes canonical variables and detects missing ones", () => {
    const text = "Здравствуйте, {client_name}! Запись: {appointment_date} в {appointment_time}.";
    const context = {
      client_name: "Ольга",
      appointment_date: "25.10.2026",
    };

    const result = substituteVariables(text, context);
    expect(result.text).toBe("Здравствуйте, Ольга! Запись: 25.10.2026 в {appointment_time}.");
    expect(result.missing).toEqual(["{appointment_time}"]);
  });

  it("supports legacy aliases such as {name}, {date}, {time}, {service}", () => {
    const text = "Cześć {name}! Wizyta {date} o {time} ({service}).";
    const context = {
      client_name: "Marek",
      appointment_date: "12.11.2026",
      appointment_time: "15:00",
      service_name: "Masaż klasyczny",
    };

    const result = substituteVariables(text, context);
    expect(result.text).toBe("Cześć Marek! Wizyta 12.11.2026 o 15:00 (Masaż klasyczny).");
    expect(result.missing).toEqual([]);
  });

  it("normalizes a raw template with multi-language translations and categories", () => {
    const raw = {
      id: "test-1",
      name: "Подтверждение",
      language: "Русский",
      body: "Здравствуйте, {client_name}",
      purpose: "booking_confirmation",
    };

    const normalized = normalizeTemplate(raw);
    expect(normalized.id).toBe("test-1");
    expect(normalized.translations.ru).toBe("Здравствуйте, {client_name}");
    expect(normalized.category).toBe("booking_confirmation");
    expect(normalized.archived).toBe(false);
  });

  it("builds starter templates when list is empty", () => {
    const list = normalizeTemplateList([]);
    expect(list.length).toBeGreaterThanOrEqual(NUAR_STARTER_TEMPLATES.length);
    expect(list.some((t) => t.category === "booking_confirmation")).toBe(true);
    expect(list.some((t) => t.category === "reminders")).toBe(true);
  });

  it("builds client context from client profile and calendar entry", () => {
    const client = {id: 42, name: "Катерина"};
    const appointment = {
      date: "2026-10-30",
      time: "18:00",
      service: "Masaż twarzy",
      master: "Natali",
      duration: 45,
      price: 180,
    };
    const settings = {studioAddress: "ul. Złota 44", studioName: "NUAR"};

    const context = buildClientContext(client, appointment, settings);
    expect(context.client_name).toBe("Катерина");
    expect(context.appointment_time).toBe("18:00");
    expect(context.service_name).toBe("Masaż twarzy");
    expect(context.master_name).toBe("Natali");
    expect(context.duration).toBe("45 мин");
    expect(context.price).toBe("180 zł");
    expect(context.studio_address).toBe("ul. Złota 44");
    expect(context.studio_name).toBe("NUAR");
  });

  it("finds client appointments sorted latest first", () => {
    const client = {id: 10, name: "Иван"};
    const entries = [
      {id: 1, clientId: 10, date: "2026-10-01", time: "10:00"},
      {id: 2, clientId: 99, date: "2026-10-20", time: "12:00"},
      {id: 3, clientId: 10, date: "2026-10-25", time: "16:00"},
    ];

    const found = findClientAppointments(client, entries);
    expect(found.length).toBe(2);
    expect(found[0].date).toBe("2026-10-25");
    expect(found[1].date).toBe("2026-10-01");
  });
});
