import {useCallback, useEffect, useState} from "react";
import {isSupabaseConfigured} from "../lib/supabase.js";

export function useAuth({onSessionLostRef, pushNotification, supabase}) {
  const [authSession, setAuthSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [passwordRecovery, setPasswordRecovery] = useState(
    () => window.location.pathname === "/reset-password",
  );

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let active = true;
    supabase.auth.getSession().then(({data}) => {
      if (!active) {
        return;
      }
      setAuthSession(data.session);
      setAuthReady(true);
    });
    const {data} = supabase.auth.onAuthStateChange((event, session) => {
      setAuthSession(session);
      setAuthReady(true);
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
      }
      if (!session) {
        onSessionLostRef?.current?.();
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [onSessionLostRef, supabase]);

  const handleLogin = useCallback(
    async (event) => {
      event.preventDefault();
      if (!supabase) {
        pushNotification({
          title: "Supabase не настроен",
          message: "Добавьте VITE_SUPABASE_URL и publishable key",
          persist: false,
        });
        return;
      }

      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "").trim();
      const password = String(form.get("password") ?? "");
      const {error} = await supabase.auth.signInWithPassword({email, password});

      if (error) {
        pushNotification({
          title: "Вход не выполнен",
          message: "Проверьте email и пароль",
          persist: false,
        });
      }
    },
    [pushNotification, supabase],
  );

  const handleGoogleLogin = useCallback(async () => {
    if (!supabase) {
      return;
    }

    const {error} = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        scopes: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
        queryParams: {
          access_type: "offline",
          include_granted_scopes: "true",
          prompt: "consent",
        },
      },
    });

    if (error) {
      pushNotification({
        title: "Вход через Google недоступен",
        message: error.message,
        persist: false,
      });
    }
  }, [pushNotification, supabase]);

  const handleResetPassword = useCallback(
    async (event) => {
      event.preventDefault();
      if (!supabase) {
        return;
      }

      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "").trim();
      const {error} = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      pushNotification({
        title: error ? "Не удалось отправить ссылку" : "Проверьте почту",
        message: error?.message || "Ссылка для сброса пароля отправлена на email",
        persist: false,
      });
    },
    [pushNotification, supabase],
  );

  const handleUpdatePassword = useCallback(
    async (event) => {
      event.preventDefault();
      if (!supabase) {
        return;
      }

      const form = new FormData(event.currentTarget);
      const password = String(form.get("password") ?? "");
      const {error} = await supabase.auth.updateUser({password});

      if (error) {
        pushNotification({
          title: "Не удалось изменить пароль",
          message: error.message,
          persist: false,
        });
        return;
      }

      setPasswordRecovery(false);
      window.history.replaceState({}, "", "/");
      pushNotification({
        title: "Пароль обновлён",
        message: "Теперь используйте новый пароль для входа",
        persist: false,
      });
    },
    [pushNotification, supabase],
  );

  const handleLogout = useCallback(() => supabase?.auth.signOut(), [supabase]);

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
