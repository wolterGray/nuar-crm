const crypto = require('crypto');

const PASSWORD_RESET_TTL_MINUTES = Math.min(
  60,
  Math.max(30, Number(process.env.AUTH_RESET_TOKEN_TTL_MINUTES) || 45),
);

const isProduction = () => process.env.NODE_ENV === 'production';

const createResetToken = () => crypto.randomBytes(32).toString('base64url');

const hashResetToken = (token = '') =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

const isAllowedOrigin = (origin = '') => {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();
    if (host === 'crm.nuarr.pl' || host === 'nuarr.pl' || host.endsWith('.nuarr.pl')) {
      return true;
    }
    if (!isProduction()) {
      if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
        return true;
      }
    }
    const appUrl = process.env.AUTH_RESET_BASE_URL || process.env.APP_URL;
    if (appUrl) {
      try {
        const parsedApp = new URL(appUrl);
        if (parsedApp.hostname.toLowerCase() === host) return true;
      } catch {}
    }
    return false;
  } catch {
    return false;
  }
};

const getResetBaseUrl = (origin = '') => {
  const configured = String(process.env.AUTH_RESET_BASE_URL ?? '').trim();
  if (configured) return configured;

  const cleanOrigin = String(origin ?? '').trim().replace(/\/+$/, '');
  if (cleanOrigin && isAllowedOrigin(cleanOrigin)) {
    return `${cleanOrigin}/reset-password`;
  }

  return isProduction()
    ? 'https://crm.nuarr.pl/reset-password'
    : 'http://localhost:5173/reset-password';
};

const buildResetUrl = (token, {origin = ''} = {}) => {
  const baseUrl = getResetBaseUrl(origin);
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
};

const createPasswordResetTokenPayload = ({origin = ''} = {}) => {
  const token = createResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
  const resetUrl = buildResetUrl(token, {origin});

  return {
    expiresAt,
    resetUrl,
    token,
    tokenHash,
  };
};

module.exports = {
  PASSWORD_RESET_TTL_MINUTES,
  buildResetUrl,
  createPasswordResetTokenPayload,
  createResetToken,
  getResetBaseUrl,
  hashResetToken,
  isAllowedOrigin,
  isProduction,
};

