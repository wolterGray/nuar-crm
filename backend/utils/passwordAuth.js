const bcrypt = require('bcryptjs');

const PASSWORD_HASH_ROUNDS = Number(process.env.PASSWORD_HASH_ROUNDS) || 12;

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const validatePasswordStrength = (password = '', {email = '', role = 'owner'} = {}) => {
  const value = String(password);
  const normalizedEmail = normalizeEmail(email);
  const emailLocalPart = normalizedEmail.split('@')[0] || '';
  const minLength = ['owner', 'admin'].includes(role) ? 12 : 10;
  const failures = [];

  if (value.length < minLength) {
    failures.push(`Password must be at least ${minLength} characters long`);
  }

  const categories = [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;

  if (categories < 3) {
    failures.push('Password must include at least 3 of: lowercase, uppercase, number, symbol');
  }

  const lower = value.toLowerCase();
  const forbiddenParts = ['password', 'admin', 'nuar', 'qwerty', '123456'];
  if (emailLocalPart.length >= 4) {
    forbiddenParts.push(emailLocalPart);
  }

  if (forbiddenParts.some((part) => part && lower.includes(part))) {
    failures.push('Password contains an unsafe word or email fragment');
  }

  const isValid = failures.length === 0;
  return {
    ok: isValid,
    isValid,
    failures,
  };
};

const cryptoRandomSegment = () =>
  require('crypto').randomBytes(12).toString('base64url').replace(/[-_]/g, 'x');

const createStrongTemporaryPassword = ({email = '', role = 'staff'} = {}) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `Tmp-${cryptoRandomSegment()}-${cryptoRandomSegment()}!9aA`;
    const strength = validatePasswordStrength(candidate, {email, role});
    if (strength.ok && strength.isValid && !/(.)\1{3,}/.test(candidate)) {
      return candidate;
    }
  }

  const error = new Error('Не удалось сгенерировать безопасный временный пароль');
  error.status = 500;
  throw error;
};

const hashPassword = (password) => bcrypt.hash(String(password), PASSWORD_HASH_ROUNDS);

const verifyPassword = (password, passwordHash) =>
  bcrypt.compare(String(password), String(passwordHash || ''));

module.exports = {
  createStrongTemporaryPassword,
  hashPassword,
  normalizeEmail,
  validatePasswordStrength,
  verifyPassword,
};
