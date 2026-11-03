const crypto = require('crypto');

const hashRefreshToken = (token) =>
  crypto.createHash('sha256').update(String(token || '')).digest('hex');

const tokensMatch = (token, expectedHash) => {
  const actual = Buffer.from(hashRefreshToken(token));
  const expected = Buffer.from(String(expectedHash || ''));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const getRequestIp = (req) => String(req?.headers?.['x-forwarded-for'] || req?.ip || '')
  .split(',')[0]
  .trim()
  .slice(0, 120) || null;

const getDeviceName = (req) => {
  const explicit = String(req?.body?.deviceName || '').trim().slice(0, 120);
  if (explicit) return explicit;
  const userAgent = String(req?.headers?.['user-agent'] || 'Unknown device');
  if (/iphone/i.test(userAgent)) return 'iPhone';
  if (/ipad/i.test(userAgent)) return 'iPad';
  if (/macintosh|mac os/i.test(userAgent)) return 'Mac';
  if (/android/i.test(userAgent)) return 'Android';
  if (/windows/i.test(userAgent)) return 'Windows';
  return 'Browser';
};

const getSessionMetadata = (req) => ({
  deviceName: getDeviceName(req),
  ip: getRequestIp(req),
  userAgent: String(req?.headers?.['user-agent'] || '').slice(0, 500) || null,
});

module.exports = {
  getSessionMetadata,
  hashRefreshToken,
  tokensMatch,
};
