const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {prisma: defaultPrisma} = require('../services/prismaClient');
const {
  createActiveUserMiddleware,
  verifyJwt,
  invalidateUserCache,
} = require('../middleware/auth');
const { getEffectivePermissions } = require('../constants/permissions');
const { authLoginLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const {
  isPasswordResetSmtpConfigured,
  sendPasswordResetEmail,
} = require('../services/passwordResetEmailService');
const {
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
const {getSessionMetadata, hashRefreshToken, tokensMatch} = require('../services/authSessionService');

function createAuthRouter({
  prismaClient = defaultPrisma,
  sendResetEmail = sendPasswordResetEmail,
  checkSmtpConfigured = isPasswordResetSmtpConfigured,
} = {}) {
  const router = express.Router();
  const prisma = prismaClient;
  const requireSessionUser = createActiveUserMiddleware(prisma);

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
    if (
      auth.role === 'owner' ||
      auth.sub === 'local-admin' ||
      auth.id === 'local-admin'
    ) {
      return 'owner';
    }

    return auth.role || 'authenticated';
  };

  const signAuthToken = (user, sessionId = null) =>
    jwt.sign({...user, ...(sessionId ? {sessionId} : {})}, getJwtSecret(), {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      subject: String(user.id),
    });

  const signRefreshToken = (user, sessionId = null) =>
    jwt.sign(
      {
        tokenType: 'refresh',
        email: user.email || '',
        role: user.role || 'authenticated',
        ...(sessionId ? {sessionId} : {}),
      },
      getJwtSecret(),
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '90d',
        jwtid: crypto.randomUUID(),
        subject: String(user.id),
      },
    );

  const createTokenPair = (user, sessionId = null) => ({
    token: signAuthToken(user, sessionId),
    refreshToken: signRefreshToken(user, sessionId),
  });

  const createPersistedTokenPair = async (user, req, existingSessionId = null) => {
    if (user.id === 'local-admin') return createTokenPair(user);
    const sessionId = existingSessionId || crypto.randomUUID();
    const tokens = createTokenPair(user, sessionId);
    const decodedRefresh = jwt.decode(tokens.refreshToken);
    const data = {
      ...getSessionMetadata(req),
      expiresAt: new Date(Number(decodedRefresh.exp) * 1000),
      lastUsedAt: new Date(),
      revokedAt: null,
      tokenHash: hashRefreshToken(tokens.refreshToken),
      userId: Number(user.id),
    };
    if (existingSessionId) {
      await prisma.authSession.update({where: {id: sessionId}, data});
    } else {
      await prisma.authSession.create({data: {id: sessionId, ...data}});
    }
    return tokens;
  };

  const verifyRefreshJwt = (req, res, next) => {
    const refreshToken = String(req.body?.refreshToken || '').trim();
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Refresh token is required' });
    }

    try {
      const decoded = jwt.verify(refreshToken, getJwtSecret());
      if (decoded?.tokenType !== 'refresh') {
        return res.status(401).json({ success: false, error: 'Invalid refresh token' });
      }
      req.auth = decoded;
      req.refreshToken = refreshToken;
      return next();
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }
  };

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

  const recordPasswordResetAudit = (
    req,
    {action, user = null, email = null, reason = null, metadata = null},
  ) =>
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
      name: '',
      role: 'owner',
      employeeId: null,
      permissions: {},
      effectivePermissions: getEffectivePermissions('owner'),
    };
    const tokens = createTokenPair(user);

    req.auth = user;
    await recordLoginAudit(req, {
      action: reason ? 'login fallback env owner' : 'login success',
      reason,
      user,
    });

    return res.json({
      success: true,
      ...tokens,
      user,
    });
  };

  router.post('/login', authLoginLimiter, async (req, res) => {
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
          const previousFailedLoginCount =
            dbUser.lockedUntil && dbUser.lockedUntil <= now
              ? 0
              : (dbUser.failedLoginCount || 0);
          const failedLoginCount = previousFailedLoginCount + 1;
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

        const effectivePermissions = getEffectivePermissions(
          updatedUser.role,
          updatedUser.permissions,
        );

        const user = {
          id: String(updatedUser.id),
          email: updatedUser.email,
          name: updatedUser.name || '',
          role: updatedUser.role,
          employeeId: updatedUser.employeeId ?? null,
          mustChangePassword: Boolean(updatedUser.permissions?.mustChangePassword),
          permissions: updatedUser.permissions || {},
          effectivePermissions,
        };
        const tokens = await createPersistedTokenPair(user, req);

        req.auth = user;
        await recordLoginAudit(req, {
          action: 'login success',
          user,
        });

        return res.json({
          success: true,
          ...tokens,
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

  router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
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

      const {expiresAt, resetUrl, tokenHash} = createPasswordResetTokenPayload({
        origin: req.headers?.origin,
      });

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
        emailResult = await sendResetEmail({email: user.email, resetUrl});
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
            smtpConfigured: checkSmtpConfigured(),
          },
          reason: emailResult.reason || 'email not sent',
          user,
        });

        if (isProduction()) {
          await recordErrorEvent(prisma, {
            context: {
              email: user.email,
              reason: emailResult.reason || 'email not sent',
              smtpConfigured: checkSmtpConfigured(),
              userId: user.id,
            },
            message: 'Password reset email was not sent',
            severity: checkSmtpConfigured() ? 'error' : 'critical',
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

  router.post('/reset-password', passwordResetLimiter, async (req, res) => {
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
          error: 'Ссылка недействительна или срок её действия истёк',
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
          error: 'Пароль не соответствует требованиям безопасности',
          details: strength.failures,
        });
      }

      const passwordHash = await hashPassword(newPassword);
      const userPermissions = (resetToken.user.permissions && typeof resetToken.user.permissions === 'object')
        ? { ...resetToken.user.permissions }
        : {};
      delete userPermissions.mustChangePassword;

      await prisma.$transaction([
        prisma.user.update({
          where: {id: resetToken.user.id},
          data: {
            failedLoginCount: 0,
            lockedUntil: null,
            passwordChangedAt: now,
            passwordHash,
            permissions: userPermissions,
          },
        }),
        prisma.passwordResetToken.update({
          where: {id: resetToken.id},
          data: {usedAt: now},
        }),
        prisma.authSession.updateMany({
          where: {userId: resetToken.user.id, revokedAt: null},
          data: {revokedAt: now},
        }),
      ]);

      invalidateUserCache(resetToken.user.id);

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

  router.post('/change-password', verifyJwt, requireSessionUser, async (req, res) => {
    const rawId = req.auth?.sub || req.auth?.id;
    const numericId = Number(rawId);
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать текущий и новый пароль',
      });
    }

    if (!Number.isInteger(numericId) || numericId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Смена пароля доступна только для пользователей базы данных',
      });
    }

    try {
      const dbUser = await prisma.user.findUnique({ where: { id: numericId } });
      if (!dbUser || !dbUser.isActive) {
        return res.status(401).json({ success: false, error: 'Пользователь не найден или отключён' });
      }
      if (dbUser.role === 'staff') {
        return res.status(403).json({
          success: false,
          error: 'Пароль сотрудника изменяет владелец в настройках доступа',
        });
      }

      const passwordMatches = await verifyPassword(currentPassword, dbUser.passwordHash);
      if (!passwordMatches) {
        return res.status(400).json({
          success: false,
          error: 'Неверный текущий пароль',
        });
      }

      const strength = validatePasswordStrength(newPassword, {
        email: dbUser.email,
        role: dbUser.role,
      });
      if (!strength.isValid) {
        return res.status(400).json({
          success: false,
          error: strength.failures?.[0] || strength.errors?.[0] || 'Новый пароль не соответствует требованиям безопасности',
        });
      }

      const passwordHash = await hashPassword(newPassword);
      const now = new Date();
      const userPermissions = (dbUser.permissions && typeof dbUser.permissions === 'object')
        ? { ...dbUser.permissions }
        : {};
      delete userPermissions.mustChangePassword;

      await prisma.$transaction([
        prisma.user.update({
          where: { id: numericId },
          data: {
            passwordHash,
            passwordChangedAt: now,
            permissions: userPermissions,
          },
        }),
        prisma.authSession.updateMany({
          where: {userId: numericId, revokedAt: null},
          data: {revokedAt: now},
        }),
      ]);

      invalidateUserCache(numericId);

      await recordPasswordResetAudit(req, {
        action: 'password change success',
        user: dbUser,
      });

      return res.json({
        success: true,
        message: 'Пароль успешно обновлён',
      });
    } catch (error) {
      console.error('Change password failed:', error);
      return res.status(500).json({
        success: false,
        error: 'Ошибка обновления пароля',
      });
    }
  });

  router.get('/session', verifyJwt, requireSessionUser, async (req, res) => {
    const rawId = req.auth?.sub || req.auth?.id;
    const role = getSessionRole(req.auth);
    const user = {
      id: String(rawId),
      email: req.auth?.email || process.env.ADMIN_EMAIL || '',
      name: req.auth?.name || '',
      role,
      employeeId: req.auth?.employeeId ? Number(req.auth.employeeId) : null,
      mustChangePassword: Boolean(req.auth?.permissions?.mustChangePassword),
      permissions: req.auth?.permissions || {},
      effectivePermissions: req.auth?.effectivePermissions || getEffectivePermissions(role, req.auth?.permissions),
    };
    const sessionId = req.auth?.sessionId || null;
    if (sessionId && rawId !== 'local-admin') {
      const session = await prisma.authSession.findFirst({
        where: {id: sessionId, userId: Number(rawId), revokedAt: null, expiresAt: {gt: new Date()}},
      });
      if (!session) return res.status(401).json({success: false, error: 'Session expired or revoked'});
    }
    const tokens = sessionId
      ? {token: signAuthToken(user, sessionId)}
      : await createPersistedTokenPair(user, req);
    return res.json({
      success: true,
      ...tokens,
      user,
    });
  });

  router.post('/refresh', verifyRefreshJwt, requireSessionUser, async (req, res) => {
    const rawId = req.auth?.sub || req.auth?.id;
    const role = getSessionRole(req.auth);
    const user = {
      id: String(rawId),
      email: req.auth?.email || process.env.ADMIN_EMAIL || '',
      name: req.auth?.name || '',
      role,
      employeeId: req.auth?.employeeId ? Number(req.auth.employeeId) : null,
      mustChangePassword: Boolean(req.auth?.permissions?.mustChangePassword),
      permissions: req.auth?.permissions || {},
      effectivePermissions: req.auth?.effectivePermissions || getEffectivePermissions(role, req.auth?.permissions),
    };
    const sessionId = req.auth?.sessionId || null;
    if (sessionId && rawId !== 'local-admin') {
      const session = await prisma.authSession.findFirst({
        where: {id: sessionId, userId: Number(rawId), revokedAt: null, expiresAt: {gt: new Date()}},
      });
      if (!session || !tokensMatch(req.refreshToken, session.tokenHash)) {
        return res.status(401).json({success: false, error: 'Invalid or reused refresh token'});
      }
    }
    const tokens = await createPersistedTokenPair(user, req, sessionId);
    return res.json({
      success: true,
      ...tokens,
      user,
    });
  });

  router.post('/logout', verifyJwt, requireSessionUser, async (req, res) => {
    const sessionId = req.auth?.sessionId;
    if (sessionId && req.auth?.sub !== 'local-admin') {
      await prisma.authSession.updateMany({
        where: {id: sessionId, userId: Number(req.auth.sub), revokedAt: null},
        data: {revokedAt: new Date()},
      });
    }
    return res.json({success: true});
  });

  router.get('/sessions', verifyJwt, requireSessionUser, async (req, res) => {
    try {
      const userId = Number(req.auth?.sub || req.auth?.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.json({success: true, sessions: []});
      }

      const now = new Date();
      const sessions = await prisma.authSession.findMany({
        where: {userId, revokedAt: null, expiresAt: {gt: now}},
        orderBy: [{lastUsedAt: 'desc'}, {createdAt: 'desc'}],
        select: {
          id: true,
          deviceName: true,
          ip: true,
          userAgent: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
        },
      });

      return res.json({
        success: true,
        sessions: sessions.map((session) => ({
          ...session,
          current: session.id === req.auth.sessionId,
        })),
      });
    } catch (error) {
      console.error('List auth sessions failed:', error);
      return res.status(500).json({success: false, error: 'Failed to load active sessions'});
    }
  });

  router.delete('/sessions/:sessionId', verifyJwt, requireSessionUser, async (req, res) => {
    try {
      const userId = Number(req.auth?.sub || req.auth?.id);
      const sessionId = String(req.params?.sessionId || '').trim();
      const result = await prisma.authSession.updateMany({
        where: {id: sessionId, userId, revokedAt: null},
        data: {revokedAt: new Date()},
      });
      if (!result.count) {
        return res.status(404).json({success: false, error: 'Session not found'});
      }

      return res.json({success: true, current: sessionId === req.auth.sessionId});
    } catch (error) {
      console.error('Revoke auth session failed:', error);
      return res.status(500).json({success: false, error: 'Failed to revoke session'});
    }
  });

  router.post('/sessions/revoke-others', verifyJwt, requireSessionUser, async (req, res) => {
    try {
      const userId = Number(req.auth?.sub || req.auth?.id);
      const result = await prisma.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(req.auth.sessionId ? {id: {not: req.auth.sessionId}} : {}),
        },
        data: {revokedAt: new Date()},
      });

      return res.json({success: true, revokedCount: result.count});
    } catch (error) {
      console.error('Revoke other auth sessions failed:', error);
      return res.status(500).json({success: false, error: 'Failed to revoke other sessions'});
    }
  });

  return router;
}

const defaultRouter = createAuthRouter();
defaultRouter.createAuthRouter = createAuthRouter;

module.exports = defaultRouter;
