import {useCallback, useEffect, useState} from "react";
import {API_URL} from "../api/config.js";

const AUTH_TOKEN_STORAGE_KEY = "nuar_crm_auth_token";
const AUTH_SESSION_STORAGE_KEY = "nuar_crm_auth_session";

const createSession = ({token, user}) => ({
  access_token: token,
  provider: "local",
  user: {
    id: user?.id || "local-admin",
    email: user?.email || "",
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
    () => window.location.pathname === "/reset-password",
  );

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
        console.error("Failed to verify local auth session:", error);
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

        if (!response.ok) {
          throw new Error("Invalid credentials");
        }

        const payload = await response.json();
        const session = createSession(payload);
        saveAuthSession(session);
        setPasswordRecovery(false);
        setAuthSession(session);
        setAuthReady(true);
      } catch {
        pushNotification({
          title: "Вход не выполнен",
          message: "Проверьте email и пароль",
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
      pushNotification({
        title: "Сброс пароля временно отключён",
        message: "Пароль задаётся через ADMIN_PASSWORD на backend",
        persist: false,
      });
    },
    [pushNotification],
  );

  const handleUpdatePassword = useCallback(
    async (event) => {
      event.preventDefault();
      setPasswordRecovery(false);
      window.history.replaceState({}, "", "/");
      pushNotification({
        title: "Смена пароля временно отключена",
        message: "Пароль задаётся через ADMIN_PASSWORD на backend",
        persist: false,
      });
    },
    [pushNotification],
  );

  const handleLogout = useCallback(() => {
    clearStoredAuth();
    setAuthSession(null);
    onSessionLostRef?.current?.();
  }, [onSessionLostRef]);

  return {
    authReady,
    authSession,
    handleGoogleLogin,
    handleLogin,
    handleLogout,
    handleResetPassword,
    handleUpdatePassword,
    passwordRecovery,
  };
}
