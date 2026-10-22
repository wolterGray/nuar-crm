import {useCallback, useEffect, useState} from "react";
import {forgotPassword, resetPassword} from "../api/auth.js";
import {API_URL} from "../api/config.js";
import {isResetPasswordPath} from "../utils/appRouting.js";

const AUTH_TOKEN_STORAGE_KEY = "nuar_crm_auth_token";
const AUTH_SESSION_STORAGE_KEY = "nuar_crm_auth_session";
const AUTH_ROLES = new Set(["owner", "admin", "manager", "staff", "readonly"]);

const normalizeSessionRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  return AUTH_ROLES.has(normalized) ? normalized : "unknown";
};

const createSession = ({token, user}) => ({
  access_token: token,
  provider: "local",
  user: {
    id: user?.id || "",
    email: user?.email || "",
    name: user?.name || "",
    role: normalizeSessionRole(user?.role),
    employeeId: user?.employeeId ?? null,
    permissions: user?.permissions || {},
    effectivePermissions: user?.effectivePermissions || {},
  },
});

const clearStoredAuth = () => {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // localStorage can be unavailable in private mode; keep auth state in memory.
  }
};

const saveAuthSession = (session) => {
  try {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.access_token);
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // localStorage can be unavailable in private mode; keep auth state in memory.
  }
};

const loadStoredSession = () => {
  try {
    const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    const session = JSON.parse(
      window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY) || "null",
    );

    return token && session?.access_token === token ? session : null;
  } catch {
    return null;
  }
};

export const getResetTokenFromUrl = () => {
  if (typeof window === "undefined") return "";
  try {
    const searchParams = new URLSearchParams(window.location.search);
    const tokenFromSearch = searchParams.get("token");

    if (tokenFromSearch) return tokenFromSearch.trim();

    const hash = window.location.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hash);
    const tokenFromHash = hashParams.get("token");
    if (tokenFromHash) return tokenFromHash.trim();
  } catch {
    // ignore URL parsing error
  }

  return "";
};

export function getAuthToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function notifyAuthTokenRejected() {
  clearStoredAuth();
  window.dispatchEvent(new Event("nuar-crm-auth-lost"));
}

export function useAuth({onSessionLostRef, pushNotification}) {
  const [authSession, setAuthSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(
    () => typeof window !== "undefined" && isResetPasswordPath(window.location.pathname),
  );
  const [resetToken, setResetToken] = useState(() => getResetTokenFromUrl());

  useEffect(() => {
    let active = true;

    const rejectSession = () => {
      if (!active) return;
      clearStoredAuth();
      setAuthSession(null);
      setAuthReady(true);
      onSessionLostRef?.current?.();
    };

    const restoreSession = async () => {
      // If user navigated directly to /reset-password, terminate existing session and do not load CRM data
      if (typeof window !== "undefined" && isResetPasswordPath(window.location.pathname)) {
        clearStoredAuth();
        setAuthSession(null);
        setAuthReady(true);
        return;
      }

      const storedSession = loadStoredSession();
      if (!storedSession?.access_token) {
        rejectSession();
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/session`, {
          headers: {
            Authorization: `Bearer ${storedSession.access_token}`,
          },
        });

        if (!response.ok) {
          rejectSession();
          return;
        }

        const payload = await response.json();
        if (!active) return;

        const session = createSession({
          token: storedSession.access_token,
          user: payload.user || storedSession.user,
        });
        saveAuthSession(session);
        setAuthSession(session);
        setAuthReady(true);
      } catch (error) {
        console.error("Failed to verify local auth session:", error?.message || "network error");
        rejectSession();
      }
    };

    const handleAuthLost = () => rejectSession();
    window.addEventListener("nuar-crm-auth-lost", handleAuthLost);
    restoreSession();

    return () => {
      active = false;
      window.removeEventListener("nuar-crm-auth-lost", handleAuthLost);
    };
  }, [onSessionLostRef]);

  const handleLogin = useCallback(
    async (event) => {
      event.preventDefault();

      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "").trim();
      const password = String(form.get("password") ?? "");

      try {
        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({email, password}),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const disabled = response.status === 403;
          const error = new Error(payload?.message || "Invalid credentials");
          error.disabled = disabled;
          throw error;
        }

        const session = createSession(payload);
        saveAuthSession(session);
        setPasswordRecovery(false);
        setAuthSession(session);
        setAuthReady(true);
      } catch (error) {
        pushNotification({
          title: error?.disabled ? "Доступ отключён" : "Вход не выполнен",
          message: error?.disabled
            ? "Аккаунт деактивирован администратором"
            : "Проверьте email и пароль",
          persist: false,
        });
      }
    },
    [pushNotification],
  );

  const handleGoogleLogin = useCallback(async () => {
    pushNotification({
      title: "Вход через Google временно отключён",
      message: "Используйте email и пароль администратора",
      persist: false,
    });
  }, [pushNotification]);

  const handleResetPassword = useCallback(
    async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "").trim();

      try {
        await forgotPassword(email);
        pushNotification({
          title: "Проверьте почту",
          message: "Если аккаунт существует, ссылка для сброса отправлена.",
          persist: false,
        });
        return true;
      } catch (error) {
        console.error("Forgot password request failed:", error);
        pushNotification({
          title: "Запрос принят",
          message: "Если аккаунт существует, ссылка для сброса отправлена.",
          persist: false,
        });
        return true;
      }
    },
    [pushNotification],
  );

  const handleCancelRecovery = useCallback(() => {
    setPasswordRecovery(false);
    setResetToken("");
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const handleUpdatePassword = useCallback(
    async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const newPassword = String(form.get("password") ?? "");
      const token = resetToken || getResetTokenFromUrl();

      if (!token) {
        const errorMsg = "Ссылка недействительна. Запросите новую ссылку для сброса пароля.";
        pushNotification({
          title: "Ссылка недействительна",
          message: errorMsg,
          persist: false,
        });
        return {success: false, error: errorMsg};
      }

      try {
        await resetPassword({token, newPassword});
        clearStoredAuth();
        setAuthSession(null);
        setPasswordRecovery(false);
        setResetToken("");
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/");
        }
        pushNotification({
          title: "Пароль обновлён",
          message: "Теперь можно войти с новым паролем.",
          persist: false,
        });
        return {success: true};
      } catch (error) {
        const errorMsg =
          error?.payload?.error ||
          error?.payload?.message ||
          error?.message ||
          "Ссылка недействительна или срок её действия истёк.";
        console.error("Reset password failed:", error?.message || "auth error");
        pushNotification({
          title: "Пароль не обновлён",
          message: errorMsg,
          persist: false,
        });
        return {success: false, error: errorMsg};
      }
    },
    [pushNotification, resetToken],
  );

  const handleLogout = useCallback(() => {
    clearStoredAuth();
    setAuthSession(null);
    onSessionLostRef?.current?.();
  }, [onSessionLostRef]);

  return {
    authReady,
    authSession,
    handleCancelRecovery,
    handleGoogleLogin,
    handleLogin,
    handleLogout,
    handleResetPassword,
    handleUpdatePassword,
    passwordRecovery,
    resetToken,
  };
}
