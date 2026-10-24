import LoginPage from "./LoginPage.jsx";
import SystemScreen from "./SystemScreen.jsx";
import ToastStack from "./ToastStack.jsx";
import {getPathFromPage, isSupportedAppPath} from "../utils/appRouting.js";

export default function AppGate({
  appSettings,
  authReady,
  authSession,
  children,
  closeNotification,
  cloudHydrated,
  cloudLoadError,
  handleCancelRecovery,
  handleGoogleLogin,
  handleLogin,
  handleLogout,
  handleResetPassword,
  handleUpdatePassword,
  initialRouteReady,
  notifications,
  passwordRecovery,
  resetToken,
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

  // Password recovery route must display immediately without waiting for DB cloud hydration
  if (passwordRecovery) {
    return (
      <>
        <LoginPage
          isRecovery={true}
          resetToken={resetToken}
          settings={appSettings}
          onCancelRecovery={handleCancelRecovery}
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

  if (!authReady || (authSession && (!cloudHydrated || !initialRouteReady))) {
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

  if (!authSession) {
    return (
      <>
        <LoginPage
          isRecovery={false}
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

  return children;
}
