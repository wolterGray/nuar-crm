import {useState} from "react";
import {resolveColorTheme} from "../utils/colorTheme.js";
import {validatePasswordStrength} from "../utils/passwordStrength.js";
import {AppIcon, Button, Card, IconButton, Input} from "./ui/index.js";

function LoginPage({
  isRecovery,
  onGoogleLogin,
  onResetPassword,
  onSubmit,
  onUpdatePassword,
  showGoogleLogin = true,
  showPasswordReset = true,
  settings,
}) {
  const [mode, setMode] = useState(isRecovery ? "recovery" : "login");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const activeMode = isRecovery ? "recovery" : mode;
  const themeMode = resolveColorTheme(settings).mode;

  const handleForgotSubmit = async (event) => {
    const ok = await onResetPassword(event);
    if (ok) setResetRequested(true);
  };

  const handleRecoverySubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setRecoveryMessage("Пароли не совпадают");
      return;
    }

    const strength = validatePasswordStrength(password);
    if (!strength.isValid) {
      setRecoveryMessage(strength.failures.join(". "));
      return;
    }

    setRecoveryMessage("");
    await onUpdatePassword(event);
  };

  return (
    <main className={`grid w-screen h-screen place-items-center p-6 bg-app-bg text-text-main theme-${themeMode}`}>
      <Card className="w-full max-w-[420px] p-8 flex flex-col gap-6 bg-surface/90 border border-border/40 rounded-card shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="grid w-12 h-12 place-items-center rounded-control bg-accent/10 text-accent shrink-0">
            <AppIcon
              name={activeMode === "login" ? "lockKeyhole" : "key"}
              size="lg"
            />
          </div>
          <div className="min-w-0">
            <small className="block text-accent text-[10px] font-bold uppercase tracking-wider mb-0.5">
              {settings.studioName}
            </small>
            <h1 className="m-0 text-text-main text-xl font-bold leading-tight">
              {activeMode === "login" ? "Вход" : activeMode === "reset" ? "Сброс пароля" : "Новый пароль"}
            </h1>
            <p className="m-0 mt-1 text-text-muted text-xs leading-normal">
              {activeMode === "login"
                ? "Доступ только для владельца салона"
                : activeMode === "reset"
                  ? "Пришлем защищённую ссылку на email"
                  : "Задайте новый пароль для входа"}
            </p>
          </div>
        </div>

        {activeMode === "login" && (
          <>
            {showGoogleLogin && (
              <>
                <Button
                  variant="secondary"
                  className="w-full flex items-center justify-center gap-3 font-medium cursor-pointer"
                  onClick={onGoogleLogin}
                >
                  <span className="grid w-5 h-5 place-items-center rounded-full bg-text-main text-surface font-bold text-xs">
                    G
                  </span>
                  Войти через Google
                </Button>
                <div className="flex items-center gap-3 text-text-faint text-xs before:h-[1px] before:flex-1 before:bg-border/60 after:h-[1px] after:flex-1 after:bg-border/60">
                  <span>или по email</span>
                </div>
              </>
            )}
            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
              <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                Email
                <Input name="email" type="email" autoComplete="username" required className="mt-1" />
              </label>
              <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                Пароль
                <span className="relative block mt-1">
                  <Input
                    name="password"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="pr-10"
                  />
                  <IconButton
                    aria-label={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main focus:outline-none transition-colors cursor-pointer"
                    icon={passwordVisible ? "eyeOff" : "eye"}
                    label={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => setPasswordVisible((current) => !current)}
                  />
                </span>
              </label>
              <Button
                variant="primary"
                type="submit"
                leftIcon="login"
                className="w-full flex items-center justify-center gap-2 mt-2 font-bold cursor-pointer">
                Войти
              </Button>
              {showPasswordReset && (
                <Button
                  variant="link"
                  type="button"
                  className="text-accent hover:underline text-xs self-center bg-transparent border-0 cursor-pointer mt-1 focus:outline-none"
                  onClick={() => {
                    setResetRequested(false);
                    setMode("reset");
                  }}>
                  Nie pamiętasz hasła? / Забыли пароль?
                </Button>
              )}
            </form>
          </>
        )}

        {activeMode === "reset" && (
          <form className="flex flex-col gap-4" onSubmit={handleForgotSubmit}>
            <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
              Email
              <Input name="email" type="email" autoComplete="email" required className="mt-1" />
            </label>
            {resetRequested && (
              <div className="rounded-control border border-border bg-field px-3 py-2 text-xs leading-normal text-text-muted">
                Если аккаунт существует, ссылка для сброса отправлена.
              </div>
            )}
            <Button
              variant="primary"
              type="submit"
              leftIcon="mail"
              className="w-full flex items-center justify-center gap-2 mt-2 font-bold cursor-pointer">
              Отправить ссылку
            </Button>
            <Button
              variant="link"
              type="button"
              className="text-accent hover:underline text-xs self-center bg-transparent border-0 cursor-pointer mt-1 focus:outline-none"
              onClick={() => setMode("login")}>
              Вернуться ко входу
            </Button>
          </form>
        )}

        {activeMode === "recovery" && (
          <form className="flex flex-col gap-4" onSubmit={handleRecoverySubmit}>
            <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
              Новый пароль
              <span className="relative block mt-1">
                <Input
                  name="password"
                  minLength="12"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="pr-10"
                />
                <IconButton
                  aria-label={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main focus:outline-none transition-colors cursor-pointer"
                  icon={passwordVisible ? "eyeOff" : "eye"}
                  label={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => setPasswordVisible((current) => !current)}
                />
              </span>
            </label>
            <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
              Повторите пароль
              <Input
                name="confirmPassword"
                minLength="12"
                type={passwordVisible ? "text" : "password"}
                autoComplete="new-password"
                required
                className="mt-1"
              />
            </label>
            <p className="m-0 text-[11px] leading-normal text-text-faint">
              Минимум 12 символов: заглавная и строчная буква, цифра и специальный символ.
            </p>
            {recoveryMessage && (
              <div className="crm-alert crm-alert-error">
                {recoveryMessage}
              </div>
            )}
            <Button
              variant="primary"
              type="submit"
              leftIcon="refresh"
              className="w-full flex items-center justify-center gap-2 mt-2 font-bold cursor-pointer">
              Сохранить новый пароль
            </Button>
            <Button
              variant="link"
              type="button"
              className="text-accent hover:underline text-xs self-center bg-transparent border-0 cursor-pointer mt-1 focus:outline-none"
              onClick={() => window.location.replace("/")}>
              Вернуться ко входу
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}

export default LoginPage;
