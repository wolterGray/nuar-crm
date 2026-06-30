const jwt = require('jsonwebtoken');

// If AUTH_REQUIRED is false (default), skip JWT verification – useful for local dev.
// When set to true, verify a JWT signed with the secret defined in JWT_SECRET.
function verifyJwt(req, res, next) {
  const authRequired = process.env.AUTH_REQUIRED === 'true';
  if (!authRequired) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');
    jwt.verify(token, secret);
    next();
  } catch (err) {
    console.error('JWT verification failed:', err);
    res.status(401).json({ error: 'Invalid JWT' });
  }
}

module.exports = { verifySupabaseJwt: verifyJwt };
