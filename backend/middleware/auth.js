const jwt = require('jsonwebtoken');

function verifyJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing Authorization header' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');
    req.auth = jwt.verify(token, secret);
    next();
  } catch (err) {
    console.error('JWT verification failed:', err);
    res.status(401).json({ success: false, error: 'Invalid JWT' });
  }
}

const isOwnerAuth = (auth = {}) => {
  const adminEmail = String(process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const authEmail = String(auth.email ?? '').trim().toLowerCase();

  return (
    auth.role === 'owner' ||
    auth.sub === 'local-admin' ||
    auth.id === 'local-admin' ||
    (adminEmail && authEmail === adminEmail)
  );
};

function requireOwner(req, res, next) {
  if (isOwnerAuth(req.auth)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Owner role required',
  });
}

module.exports = {
  requireOwner,
  verifyJwt,
};
