import {LockKeyhole, LogIn} from "lucide-react";

function LoginPage({settings, onSubmit}) {
  return (
    <main className={`login-screen theme-${settings.theme}`}>
      <section className="login-card">
        <div className="login-brand">
          <span className="login-brand-mark">N</span>
          <div>
            <strong>{settings.studioName}</strong>
            <small>CRM</small>
          </div>
        </div>

        <div className="login-heading">
          <div className="login-icon">
            <LockKeyhole size={24} />
          </div>
          <div>
            <h1>Вход в CRM</h1>
            <p>Доступ только для владельца салона</p>
          </div>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Пароль
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="submit-button" type="submit">
            <LogIn size={17} />
            Войти
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
