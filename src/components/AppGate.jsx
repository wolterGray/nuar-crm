import LoginPage from "./LoginPage.jsx";
import SystemScreen from "./SystemScreen.jsx";
import ToastStack from "./ToastStack.jsx";
import {getPathFromPage, isSupportedAppPath} from "../utils/appRouting.js";

export default function AppGate({
  appSettings,
  authReady,
  authSession,
  backendLoadError,
  children,
  closeNotification,
  cloudHydrated,
  cloudLoadError,
  handleGoogleLogin,
  handleLogin,
  handleLogout,
  handleResetPassword,
  handleUpdatePassword,
  notifications,
  passwordRecovery,
}) {
  const currentPath = window.location.pathname;

  if (!isSupportedAppPath(currentPath)) {
    return (
      <SystemScreen
        actionLabel="На главную"
        message="Такой страницы в CRM нет. Вернитесь к рабочему интерфейсу."
        mode="not-found"
        settings={appSettings}
        title="Страница не найдена"
        onAction={() => {
          window.history.replaceState({page: "calendar"}, "", getPathFromPage("calendar"));
          window.location.reload();
        }}
      />
    );
  }

  if (!authReady) {
    return (
      <SystemScreen
        message="Проверяем защищённую сессию владельца."
        settings={appSettings}
        title="Подключаем CRM"
      />
    );
  }

  if (!authSession || passwordRecovery) {
    return (
      <>
        <LoginPage
          isRecovery={passwordRecovery}
          settings={appSettings}
          onGoogleLogin={handleGoogleLogin}
          onResetPassword={handleResetPassword}
          onSubmit={handleLogin}
          onUpdatePassword={handleUpdatePassword}
          showGoogleLogin={false}
          showPasswordReset={false}
        />
        <ToastStack notifications={notifications} onClose={closeNotification} />
      </>
    );
  }

  if (!cloudHydrated) {
    return (
      <SystemScreen
        actionLabel="Повторить"
        message={
          cloudLoadError ||
          "Получаем актуальные данные из защищённого хранилища Supabase."
        }
        mode={cloudLoadError ? "error" : "loading"}
        settings={appSettings}
        title={cloudLoadError ? "Не удалось загрузить базу" : "Загружаем CRM"}
        onAction={cloudLoadError ? () => window.location.reload() : undefined}
        onLogout={cloudLoadError ? handleLogout : undefined}
      />
    );
  }

  if (backendLoadError) {
    return (
      <SystemScreen
        actionLabel="Повторить загрузку"
        message="Backend недоступен, данные могут быть устаревшими. Проверьте подключение к серверу и повторите загрузку."
        mode="error"
        settings={appSettings}
        title="Backend недоступен"
        onAction={() => window.location.reload()}
        onLogout={handleLogout}
      />
    );
  }

  return children;
}
