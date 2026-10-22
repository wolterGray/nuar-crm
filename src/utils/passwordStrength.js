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

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*+-=";
const ALL_CHARS = UPPER + LOWER + DIGITS + SYMBOLS;

function randomInt(max) {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    const arr = new Uint32Array(1);
    globalThis.crypto.getRandomValues(arr);
    return arr[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function pickChar(charset) {
  return charset[randomInt(charset.length)];
}

export function generateStrongPassword({email = ""} = {}) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const chars = [
      pickChar(UPPER),
      pickChar(LOWER),
      pickChar(DIGITS),
      pickChar(SYMBOLS),
      pickChar(UPPER),
      pickChar(LOWER),
      pickChar(DIGITS),
      pickChar(SYMBOLS),
    ];

    while (chars.length < 14) {
      chars.push(pickChar(ALL_CHARS));
    }

    // Fisher-Yates shuffle
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = randomInt(i + 1);
      const tmp = chars[i];
      chars[i] = chars[j];
      chars[j] = tmp;
    }

    const candidate = chars.join("");
    const check = validatePasswordStrength(candidate, {email});
    if (check.isValid) {
      return candidate;
    }
  }

  return "K9mP#7vR2x!L4q";
}

