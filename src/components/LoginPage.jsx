import {Eye, EyeOff, KeyRound, LockKeyhole, LogIn, Mail, RotateCcw} from "lucide-react";
import {useState} from "react";

function LoginPage({
  isRecovery,
  onGoogleLogin,
  onResetPassword,
  onSubmit,
  onUpdatePassword,
  settings,
}) {
  const [mode, setMode] = useState(isRecovery ? "recovery" : "login");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const activeMode = isRecovery ? "recovery" : mode;

  return (
    <main className={`login-screen theme-${settings.theme}`}>
      <section className="login-card">
        <div className="login-heading">
          <div className="login-icon">
            {activeMode === "login" ? <LockKeyhole size={24} /> : <KeyRound size={24} />}
          </div>
          <div>
            <small>{settings.studioName}</small>
            <h1>{activeMode === "login" ? "Вход" : activeMode === "reset" ? "Сброс пароля" : "Новый пароль"}</h1>
            <p>
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
            <button className="google-login-button" type="button" onClick={onGoogleLogin}>
              <span>G</span>
              Войти через Google
            </button>
            <div className="login-divider"><span>или по email</span></div>
            <form className="login-form" onSubmit={onSubmit}>
              <label>
                Email
                <input name="email" type="email" autoComplete="username" required />
              </label>
              <label>
                Пароль
                <span className="password-field">
                  <input
                    name="password"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    aria-label={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
                    title={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
                    type="button"
                    onClick={() => setPasswordVisible((current) => !current)}>
                    {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>
              <button className="submit-button" type="submit">
                <LogIn size={17} />
                Войти
              </button>
              <button className="login-link-button" type="button" onClick={() => setMode("reset")}>
                Забыли пароль?
              </button>
            </form>
          </>
        )}

        {activeMode === "reset" && (
          <form className="login-form" onSubmit={onResetPassword}>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <button className="submit-button" type="submit">
              <Mail size={17} />
              Отправить ссылку
            </button>
            <button className="login-link-button" type="button" onClick={() => setMode("login")}>
              Вернуться ко входу
            </button>
          </form>
        )}

        {activeMode === "recovery" && (
          <form className="login-form" onSubmit={onUpdatePassword}>
            <label>
              Новый пароль
              <span className="password-field">
                <input
                  name="password"
                  minLength="8"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="new-password"
                  required
                />
                <button
                  aria-label={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
                  type="button"
                  onClick={() => setPasswordVisible((current) => !current)}>
                  {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            <button className="submit-button" type="submit">
              <RotateCcw size={17} />
              Сохранить новый пароль
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default LoginPage;
