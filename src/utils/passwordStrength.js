const MIN_PASSWORD_LENGTH = 12;

export function validatePasswordStrength(password = "", {email = ""} = {}) {
  const value = String(password);
  const lowerValue = value.toLowerCase();
  const normalizedEmail = String(email).trim().toLowerCase();
  const emailUser = normalizedEmail.split("@")[0] || "";
  const failures = [];

  if (value.length < MIN_PASSWORD_LENGTH) {
    failures.push(`Минимум ${MIN_PASSWORD_LENGTH} символов`);
  }

  if (!/[a-z]/.test(value)) failures.push("Добавьте строчную букву");
  if (!/[A-Z]/.test(value)) failures.push("Добавьте заглавную букву");
  if (!/\d/.test(value)) failures.push("Добавьте цифру");
  if (!/[^A-Za-z0-9]/.test(value)) failures.push("Добавьте специальный символ");

  if (/(.)\1{3,}/.test(value)) {
    failures.push("Не используйте длинные повторы символов");
  }

  const forbiddenParts = ["password", "admin", "nuar", "qwerty", "123456"];
  if (forbiddenParts.some((part) => lowerValue.includes(part))) {
    failures.push("Не используйте очевидные слова");
  }

  if (emailUser && emailUser.length >= 4 && lowerValue.includes(emailUser)) {
    failures.push("Пароль не должен содержать email");
  }

  return {
    failures,
    isValid: failures.length === 0,
  };
}
