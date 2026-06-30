const express = require('express');
const jwt = require('jsonwebtoken');
const { verifySupabaseJwt } = require('../middleware/auth');

const router = express.Router();

const getAuthConfig = () => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !JWT_SECRET) {
    return null;
  }

  return { ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET };
};

router.post('/login', (req, res) => {
  const config = getAuthConfig();
  if (!config) {
    return res.status(500).json({
      error: 'Auth is not configured',
      message: 'Set ADMIN_EMAIL, ADMIN_PASSWORD and JWT_SECRET on the backend',
    });
  }

  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const adminEmail = config.ADMIN_EMAIL.trim().toLowerCase();

  if (email !== adminEmail || password !== config.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = {
    id: 'local-admin',
    email: config.ADMIN_EMAIL,
  };
  const token = jwt.sign(user, config.JWT_SECRET, {
    expiresIn: '7d',
    subject: user.id,
  });

  res.json({
    success: true,
    token,
    user,
  });
});

router.get('/session', verifySupabaseJwt, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.auth?.sub || req.auth?.id || 'local-admin',
      email: req.auth?.email || process.env.ADMIN_EMAIL || '',
    },
  });
});

module.exports = router;
