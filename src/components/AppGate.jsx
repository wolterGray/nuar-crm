import LoginPage from "./LoginPage.jsx";
import SystemScreen from "./SystemScreen.jsx";
import ToastStack from "./ToastStack.jsx";

const supportedPaths = ["/", "/reset-password"];

export default function AppGate({
  appSettings,
  authReady,
  authSession,
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

  if (!supportedPaths.includes(currentPath)) {
    return (
      <SystemScreen
        actionLabel="На главную"
        message="Такой страницы в CRM нет. Вернитесь к рабочему интерфейсу."
        mode="not-found"
        settings={appSettings}
        title="Страница не найдена"
        onAction={() => {
          window.history.replaceState({}, "", "/");
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

  return children;
}
