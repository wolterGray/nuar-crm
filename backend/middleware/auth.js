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

module.exports = {
  verifyJwt,
  verifySupabaseJwt: verifyJwt,
};
