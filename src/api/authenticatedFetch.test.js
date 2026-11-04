import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {authenticatedFetch} from "./authenticatedFetch.js";

const TOKEN_KEY = "nuar_crm_auth_token";
let storage;

beforeEach(() => {
  storage = new Map();
  const target = new EventTarget();
  vi.stubGlobal("CustomEvent", class extends Event {
    constructor(type, options = {}) {
      super(type);
      this.detail = options.detail;
    }
  });
  vi.stubGlobal("window", {
    addEventListener: target.addEventListener.bind(target),
    clearTimeout,
    dispatchEvent: target.dispatchEvent.bind(target),
    localStorage: {
      clear: () => storage.clear(),
      getItem: (key) => storage.get(key) ?? null,
      removeItem: (key) => storage.delete(key),
      setItem: (key, value) => storage.set(key, String(value)),
    },
    setTimeout,
  });
});

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("authenticatedFetch", () => {
  it("refreshes an expired session and retries the request once with the new token", async () => {
    window.localStorage.setItem(TOKEN_KEY, "expired-token");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, {status: 401}))
      .mockResolvedValueOnce(new Response(JSON.stringify({ok: true}), {
        headers: {"Content-Type": "application/json"},
        status: 200,
      }));
    vi.stubGlobal("fetch", fetchMock);
    window.addEventListener("nuar-crm-auth-lost", (event) => {
      window.localStorage.setItem(TOKEN_KEY, "fresh-token");
      event.detail.resolve({access_token: "fresh-token"});
    }, {once: true});

    const response = await authenticatedFetch("https://api.nuarr.pl/api/clients", {
      body: JSON.stringify({name: "Client"}),
      headers: {"Content-Type": "application/json", "Idempotency-Key": "same-operation"},
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer expired-token");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer fresh-token");
    expect(fetchMock.mock.calls[1][1].headers["Idempotency-Key"]).toBe("same-operation");
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({name: "Client"}));
  });

  it("returns the original unauthorized response when recovery is rejected", async () => {
    window.localStorage.setItem(TOKEN_KEY, "expired-token");
    const unauthorized = new Response(null, {status: 401});
    const fetchMock = vi.fn().mockResolvedValue(unauthorized);
    vi.stubGlobal("fetch", fetchMock);
    window.addEventListener("nuar-crm-auth-lost", (event) => {
      event.detail.reject(new Error("Refresh token expired"));
    }, {once: true});

    const response = await authenticatedFetch("https://api.nuarr.pl/api/clients");

    expect(response).toBe(unauthorized);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
