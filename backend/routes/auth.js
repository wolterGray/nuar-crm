const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { verifySupabaseJwt } = require('../middleware/auth');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const {
  isPasswordResetSmtpConfigured,
  sendPasswordResetEmail,
} = require('../services/passwordResetEmailService');
const {
  PASSWORD_RESET_TTL_MINUTES,
  createPasswordResetTokenPayload,
  hashResetToken,
  isProduction,
} = require('../utils/passwordResetTokens');
const {
  hashPassword,
  normalizeEmail,
  validatePasswordStrength,
  verifyPassword,
} = require('../utils/passwordAuth');

const router = express.Router();
const prisma = new PrismaClient();

const getJwtSecret = () => String(process.env.JWT_SECRET ?? '').trim();

const getEnvAdminConfig = () => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  const JWT_SECRET = getJwtSecret();

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

const signAuthToken = (user) =>
  jwt.sign(user, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    subject: String(user.id),
  });

const getActiveOwnerCount = async () =>
  prisma.user.count({
    where: {
      isActive: true,
      role: 'owner',
    },
  });

const recordLoginAudit = (req, {action, email, user = null, reason = null}) =>
  recordAuditLog(prisma, req, {
    action,
    after: {
      email: email || user?.email || null,
      reason,
      role: user?.role || null,
    },
    before: null,
    entity: 'Auth',
    entityId: user?.id ? String(user.id) : email || null,
  });

const PASSWORD_RESET_GENERIC_RESPONSE = {
  success: true,
  message: 'If the account exists, reset instructions were sent.',
};

const recordPasswordResetAudit = (req, {action, user = null, email = null, reason = null, metadata = null}) =>
  recordAuditLog(prisma, req, {
    action,
    after: {
      email: email || user?.email || null,
      metadata,
      reason,
      role: user?.role || null,
    },
    before: null,
    entity: 'Auth',
    entityId: user?.id ? String(user.id) : email || null,
  });

const loginWithEnvAdminFallback = async (req, res, {email, password, reason}) => {
  const config = getEnvAdminConfig();
  if (!config) {
    return res.status(500).json({
      error: 'Auth is not configured',
      message: 'Set DB owner or ADMIN_EMAIL, ADMIN_PASSWORD and JWT_SECRET on the backend',
    });
  }

  const adminEmail = normalizeEmail(config.ADMIN_EMAIL);

  if (email !== adminEmail || password !== config.ADMIN_PASSWORD) {
    req.auth = { email: email || 'unknown' };
    await recordLoginAudit(req, {
      action: 'login failed',
      email: email || null,
      reason: 'invalid credentials',
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = {
    id: 'local-admin',
    email: config.ADMIN_EMAIL,
    role: 'owner',
  };
  const token = signAuthToken(user);

  req.auth = user;
  await recordLoginAudit(req, {
    action: reason ? 'login fallback env owner' : 'login success',
    reason,
    user,
  });

  return res.json({
    success: true,
    token,
    user,
  });
};

router.post('/login', async (req, res) => {
  if (!getJwtSecret()) {
    return res.status(500).json({
      error: 'Auth is not configured',
      message: 'Set JWT_SECRET on the backend',
    });
  }

  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password ?? '');

  try {
    const dbUser = email
      ? await prisma.user.findUnique({ where: { email } })
      : null;

    if (dbUser) {
      const now = new Date();
      if (!dbUser.isActive) {
        req.auth = { email: dbUser.email, id: String(dbUser.id), role: dbUser.role };
        await recordLoginAudit(req, {
          action: 'login failed',
          reason: 'inactive user',
          user: dbUser,
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (dbUser.lockedUntil && dbUser.lockedUntil > now) {
        req.auth = { email: dbUser.email, id: String(dbUser.id), role: dbUser.role };
        await recordLoginAudit(req, {
          action: 'login failed',
          reason: 'user locked',
          user: dbUser,
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const passwordMatches = await verifyPassword(password, dbUser.passwordHash);
      if (!passwordMatches) {
        const failedLoginCount = (dbUser.failedLoginCount || 0) + 1;
        const lockedUntil =
          failedLoginCount >= 5
            ? new Date(Date.now() + 10 * 60 * 1000)
            : null;

        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            failedLoginCount,
            lockedUntil,
          },
        });

        req.auth = { email: dbUser.email, id: String(dbUser.id), role: dbUser.role };
        await recordLoginAudit(req, {
          action: 'login failed',
          reason: lockedUntil ? 'invalid credentials locked' : 'invalid credentials',
          user: dbUser,
        });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const updatedUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          failedLoginCount: 0,
          lastLoginAt: now,
          lockedUntil: null,
        },
      });

      const user = {
        id: String(updatedUser.id),
        email: updatedUser.email,
        role: updatedUser.role,
      };
      const token = signAuthToken(user);

      req.auth = user;
      await recordLoginAudit(req, {
        action: 'login success',
        user,
      });

      return res.json({
        success: true,
        token,
        user,
      });
    }

    const activeOwnerCount = await getActiveOwnerCount();
    if (activeOwnerCount === 0) {
      return loginWithEnvAdminFallback(req, res, {
        email,
        password,
        reason: 'db owner missing',
      });
    }

    req.auth = { email: email || 'unknown' };
    await recordLoginAudit(req, {
      action: 'login failed',
      email: email || null,
      reason: 'invalid credentials',
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    if (error?.code === 'P2021' || error?.code === 'P2022') {
      return loginWithEnvAdminFallback(req, res, {
        email,
        password,
        reason: 'auth tables unavailable',
      });
    }

    console.error('DB auth login failed:', error);
    return res.status(500).json({ error: 'Auth failed' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const responsePayload = {...PASSWORD_RESET_GENERIC_RESPONSE};

  try {
    const user = email
      ? await prisma.user.findUnique({where: {email}})
      : null;

    if (!user || !user.isActive) {
      req.auth = {email: email || 'unknown'};
      return res.json(responsePayload);
    }

    const {expiresAt, resetUrl, tokenHash} = createPasswordResetTokenPayload();

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      }),
      prisma.passwordResetToken.create({
        data: {
          expiresAt,
          ip: req.ip || req.headers?.['x-forwarded-for'] || null,
          tokenHash,
          userAgent: req.headers?.['user-agent'] || null,
          userId: user.id,
        },
      }),
    ]);

    let emailResult = {sent: false, reason: 'not attempted'};
    try {
      emailResult = await sendPasswordResetEmail({email: user.email, resetUrl});
    } catch (error) {
      emailResult = {sent: false, reason: error?.message || 'email failed'};
      console.error('Password reset email failed:', error);
    }

    req.auth = {email: user.email, id: String(user.id), role: user.role};
    await recordPasswordResetAudit(req, {
      action: 'password reset requested',
      metadata: {
        expiresAt,
      },
      user,
    });

    if (emailResult.sent) {
      await recordPasswordResetAudit(req, {
        action: 'reset email sent',
        metadata: {
          messageId: emailResult.messageId || null,
        },
        user,
      });
    } else {
      await recordPasswordResetAudit(req, {
        action: 'reset email failed',
        metadata: {
          smtpConfigured: isPasswordResetSmtpConfigured(),
        },
        reason: emailResult.reason || 'email not sent',
        user,
      });

      if (isProduction()) {
        await recordErrorEvent(prisma, {
          context: {
            email: user.email,
            reason: emailResult.reason || 'email not sent',
            smtpConfigured: isPasswordResetSmtpConfigured(),
            userId: user.id,
          },
          message: 'Password reset email was not sent',
          severity: isPasswordResetSmtpConfigured() ? 'error' : 'critical',
          source: 'auth.password-reset-email',
        });
      }
    }

    if (!isProduction()) {
      responsePayload.resetUrl = resetUrl;
    } else if (!emailResult.sent) {
      console.warn('[auth] Password reset token created but email was not sent. Configure SMTP env.');
    }

    return res.json(responsePayload);
  } catch (error) {
    if (error?.code === 'P2021' || error?.code === 'P2022') {
      return res.json(responsePayload);
    }

    console.error('Forgot password failed:', error);
    return res.json(responsePayload);
  }
});

router.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token ?? '').trim();
  const newPassword = String(req.body?.newPassword ?? req.body?.password ?? '');
  const tokenHash = hashResetToken(token);

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Token and newPassword are required',
    });
  }

  try {
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: {tokenHash},
      include: {user: true},
    });

    const now = new Date();
    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= now ||
      !resetToken.user ||
      !resetToken.user.isActive
    ) {
      req.auth = resetToken?.user
        ? {
            email: resetToken.user.email,
            id: String(resetToken.user.id),
            role: resetToken.user.role,
          }
        : {id: 'password-reset'};
      await recordPasswordResetAudit(req, {
        action: 'password reset failed',
        reason: !resetToken
          ? 'token not found'
          : resetToken.usedAt
            ? 'token used'
            : resetToken.expiresAt <= now
              ? 'token expired'
              : 'inactive user',
        user: resetToken?.user || null,
      });

      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
    }

    const strength = validatePasswordStrength(newPassword, {
      email: resetToken.user.email,
      role: resetToken.user.role,
    });
    if (!strength.ok) {
      req.auth = {
        email: resetToken.user.email,
        id: String(resetToken.user.id),
        role: resetToken.user.role,
      };
      await recordPasswordResetAudit(req, {
        action: 'password reset failed',
        reason: 'weak password',
        user: resetToken.user,
      });

      return res.status(400).json({
        success: false,
        error: 'Password does not meet security requirements',
        details: strength.failures,
      });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: {id: resetToken.user.id},
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          passwordChangedAt: now,
          passwordHash,
        },
      }),
      prisma.passwordResetToken.update({
        where: {id: resetToken.id},
        data: {usedAt: now},
      }),
    ]);

    req.auth = {
      email: resetToken.user.email,
      id: String(resetToken.user.id),
      role: resetToken.user.role,
    };
    await recordPasswordResetAudit(req, {
      action: 'password reset success',
      user: resetToken.user,
    });

    return res.json({success: true});
  } catch (error) {
    console.error('Reset password failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Password reset failed',
    });
  }
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
