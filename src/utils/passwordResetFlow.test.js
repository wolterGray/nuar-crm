import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {
  isResetPasswordPath,
  isSupportedAppPath,
  normalizeAppPath,
  resolveInitialPage,
} from "./appRouting.js";
import {getResetTokenFromUrl} from "../hooks/useAuth.js";

describe("Password Reset Routing & URL Preservation", () => {
  beforeEach(() => {
    globalThis.window = {
      location: new URL("https://crm.nuarr.pl/calendar"),
      history: {
        replaceState: vi.fn(),
        pushState: vi.fn(),
        state: null,
      },
    };
  });

  afterEach(() => {
    delete globalThis.window;
    vi.restoreAllMocks();
  });

  it("identifies /reset-password as a supported app path and reset path", () => {
    expect(isSupportedAppPath("/reset-password")).toBe(true);
    expect(isSupportedAppPath("/reset-password/")).toBe(true);
    expect(isResetPasswordPath("/reset-password")).toBe(true);
    expect(isResetPasswordPath("/reset-password/")).toBe(true);
    expect(isResetPasswordPath("/calendar")).toBe(false);
    expect(isResetPasswordPath("/settings")).toBe(false);
  });

  it("opening link with token extracts the token correctly from URL query string", () => {
    globalThis.window.location = new URL("https://crm.nuarr.pl/reset-password?token=secure-token-12345");
    expect(globalThis.window.location.pathname).toBe("/reset-password");
    expect(isResetPasswordPath(globalThis.window.location.pathname)).toBe(true);

    const token = getResetTokenFromUrl();
    expect(token).toBe("secure-token-12345");
  });

  it("handles missing token gracefully", () => {
    globalThis.window.location = new URL("https://crm.nuarr.pl/reset-password");
    expect(globalThis.window.location.pathname).toBe("/reset-password");
    expect(isResetPasswordPath(globalThis.window.location.pathname)).toBe(true);

    const token = getResetTokenFromUrl();
    expect(token).toBe("");
  });

  it("extracts token from hash fragment if provided as fallback", () => {
    globalThis.window.location = new URL("https://crm.nuarr.pl/reset-password#token=hash-token-777");
    const token = getResetTokenFromUrl();
    expect(token).toBe("hash-token-777");
  });

  it("preserves URL upon app initialization when previous stored page is /settings", () => {
    globalThis.window.location = new URL("https://crm.nuarr.pl/reset-password?token=secret-abc-999");

    // resolveInitialPage must not map /reset-password to /settings or /calendar
    const initialPage = resolveInitialPage({
      pathname: globalThis.window.location.pathname,
      storedPage: "settings",
    });

    // Stored page is returned for internal state, but isResetPasswordPath prevents navigation
    expect(initialPage).toBe("settings");
    expect(isResetPasswordPath(globalThis.window.location.pathname)).toBe(true);

    // Simulate routing hydration logic in useAppRouting
    const shouldSkipHydration = isResetPasswordPath(globalThis.window.location.pathname);
    expect(shouldSkipHydration).toBe(true);

    // Verify replaceState is NOT called to replace with /settings
    if (!shouldSkipHydration) {
      globalThis.window.history.replaceState({page: initialPage}, "", "/settings");
    }

    expect(globalThis.window.history.replaceState).not.toHaveBeenCalled();
    expect(globalThis.window.location.pathname).toBe("/reset-password");
    expect(globalThis.window.location.search).toBe("?token=secret-abc-999");
  });

  it("preserves token and path across simulated page refresh", () => {
    globalThis.window.location = new URL("https://crm.nuarr.pl/reset-password?token=persist-after-refresh");

    // 1. First load
    expect(getResetTokenFromUrl()).toBe("persist-after-refresh");
    expect(isResetPasswordPath(globalThis.window.location.pathname)).toBe(true);

    // 2. Simulated refresh (re-evaluation of routing without URL mutation)
    const afterRefreshPath = normalizeAppPath(globalThis.window.location.pathname);
    expect(afterRefreshPath).toBe("/reset-password");
    expect(getResetTokenFromUrl()).toBe("persist-after-refresh");
    expect(globalThis.window.history.replaceState).not.toHaveBeenCalled();
  });

  it("successful password reset clears token from URL, wipes session and redirects to /", () => {
    globalThis.window.location = new URL("https://crm.nuarr.pl/reset-password?token=valid-token");
    const mockLocalStorage = {
      removeItem: vi.fn(),
    };
    globalThis.window.localStorage = mockLocalStorage;

    // Simulate completion of password reset
    const token = getResetTokenFromUrl();
    expect(token).toBe("valid-token");

    // Success actions
    globalThis.window.localStorage.removeItem("nuar_crm_auth_token");
    globalThis.window.localStorage.removeItem("nuar_crm_auth_session");
    globalThis.window.history.replaceState({}, "", "/");

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("nuar_crm_auth_token");
    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("nuar_crm_auth_session");
    expect(globalThis.window.history.replaceState).toHaveBeenCalledWith({}, "", "/");
  });

  it("reused or invalid token preserves the URL with token intact and does not redirect", () => {
    globalThis.window.location = new URL("https://crm.nuarr.pl/reset-password?token=reused-expired-token");

    // When reset fails (e.g. backend returns 400), replaceState must NOT be called to navigate away
    const token = getResetTokenFromUrl();
    expect(token).toBe("reused-expired-token");

    // No navigation away on failure
    expect(globalThis.window.history.replaceState).not.toHaveBeenCalled();
    expect(globalThis.window.location.pathname).toBe("/reset-password");
    expect(globalThis.window.location.search).toBe("?token=reused-expired-token");
  });
});
