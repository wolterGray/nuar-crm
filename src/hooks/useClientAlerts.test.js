import {describe, expect, it} from "vitest";
import {
  getServerEventId,
  isServerAlertId,
  mapServerEventToAlert,
} from "./useClientAlerts.js";

describe("useClientAlerts server event mapping", () => {
  it("correctly identifies server alert IDs and extracts event IDs", () => {
    expect(isServerAlertId("server-notification-101")).toBe(true);
    expect(isServerAlertId("local-alert-42")).toBe(false);
    expect(getServerEventId("server-notification-101")).toBe(101);
  });

  it("maps site booking requests with operations target and action priority", () => {
    const alert = mapServerEventToAlert({
      category: "action",
      createdAt: "2026-10-24T18:00:00Z",
      entityId: "12",
      id: 55,
      message: "Новая запись с сайта",
      payload: {clientName: "Анна", service: "Массаж"},
      title: "Новая бронь",
      type: "site_booking_request",
    });

    expect(alert.id).toBe("server-notification-55");
    expect(alert.page).toBe("operations");
    expect(alert.type).toBe("site_booking");
    expect(alert.priority).toBe("action");
    expect(alert.actions).toEqual(["open", "dismiss"]);
  });

  it("maps visit notifications to calendar page", () => {
    const alert = mapServerEventToAlert({
      category: "information",
      createdAt: "2026-10-24T18:00:00Z",
      entityId: "99",
      id: 56,
      message: "Перенос записи",
      payload: {date: "2026-10-25", time: "15:00"},
      title: "Перенос записи",
      type: "visit_rescheduled",
    });

    expect(alert.id).toBe("server-notification-56");
    expect(alert.page).toBe("calendar");
    expect(alert.type).toBe("visit_rescheduled");
    expect(alert.actions).toEqual(["open", "dismiss"]);
  });

  it("maps out of stock supplies with critical priority", () => {
    const alert = mapServerEventToAlert({
      category: "critical",
      createdAt: "2026-10-24T18:00:00Z",
      entityId: "7",
      id: 57,
      message: "Масло 0 шт",
      payload: {minStock: 2, stock: 0},
      title: "Расходник закончился",
      type: "supply_out_of_stock",
    });

    expect(alert.page).toBe("operations");
    expect(alert.type).toBe("supply_out_of_stock");
    expect(alert.priority).toBe("critical");
  });
});
