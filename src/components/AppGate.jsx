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

  if (!authReady || (authSession && !cloudHydrated)) {
    const hasCloudError = Boolean(authReady && authSession && cloudLoadError);

    return (
      <SystemScreen
        actionLabel={hasCloudError ? "Повторить" : undefined}
        message={
          hasCloudError
            ? cloudLoadError
            : "Подключаем защищённую сессию и актуальные данные CRM."
        }
        mode={hasCloudError ? "error" : "loading"}
        settings={appSettings}
        title={hasCloudError ? "Не удалось загрузить базу" : "Загружаем CRM"}
        onAction={hasCloudError ? () => window.location.reload() : undefined}
        onLogout={hasCloudError ? handleLogout : undefined}
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
