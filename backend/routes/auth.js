const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { verifySupabaseJwt } = require('../middleware/auth');
const { recordAuditLog } = require('../services/loggingService');

const router = express.Router();
const prisma = new PrismaClient();

const getAuthConfig = () => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !JWT_SECRET) {
    return null;
  }

  return { ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET };
};

const getSessionRole = (auth = {}) => {
  const adminEmail = String(process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const authEmail = String(auth.email ?? '').trim().toLowerCase();

  if (
    auth.role === 'owner' ||
    auth.sub === 'local-admin' ||
    auth.id === 'local-admin' ||
    (adminEmail && authEmail === adminEmail)
  ) {
    return 'owner';
  }

  return auth.role || 'authenticated';
};

router.post('/login', async (req, res) => {
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
    req.auth = { email: email || 'unknown' };
    await recordAuditLog(prisma, req, {
      action: 'login failed',
      after: {
        email: email || null,
        reason: 'invalid credentials',
      },
      before: null,
      entity: 'Auth',
      entityId: email || null,
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = {
    id: 'local-admin',
    email: config.ADMIN_EMAIL,
    role: 'owner',
  };
  const token = jwt.sign(user, config.JWT_SECRET, {
    expiresIn: '7d',
    subject: user.id,
  });

  req.auth = user;
  await recordAuditLog(prisma, req, {
    action: 'login success',
    after: {
      email: user.email,
      role: user.role,
    },
    before: null,
    entity: 'Auth',
    entityId: user.id,
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
      role: getSessionRole(req.auth),
    },
  });
});

module.exports = router;
