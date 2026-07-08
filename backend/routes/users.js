const express = require('express');
const {PrismaClient} = require('@prisma/client');
const {requireOwner} = require('../middleware/auth');
const {recordAuditLog, recordErrorEvent} = require('../services/loggingService');
const {
  isPasswordResetSmtpConfigured,
  sendPasswordResetEmail,
} = require('../services/passwordResetEmailService');
const {
  createPasswordResetTokenPayload,
  isProduction,
} = require('../utils/passwordResetTokens');
const {
  hashPassword,
  normalizeEmail,
  validatePasswordStrength,
} = require('../utils/passwordAuth');

const router = express.Router();
const prisma = new PrismaClient();

const USER_ROLES = new Set(['owner', 'admin', 'manager', 'staff', 'readonly']);
const USER_SELECT = {
  createdAt: true,
  email: true,
  id: true,
  isActive: true,
  lastLoginAt: true,
  name: true,
  role: true,
  updatedAt: true,
};

const serializeUser = (user) => ({
  createdAt: user.createdAt,
  email: user.email,
  id: user.id,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  name: user.name || '',
  role: user.role,
  updatedAt: user.updatedAt,
});

const createStrongTemporaryPassword = () =>
  `Temp-${cryptoRandomSegment()}-${cryptoRandomSegment()}!9aA`;

const cryptoRandomSegment = () =>
  require('crypto').randomBytes(9).toString('base64url');

const parseUserPayload = (body = {}) => {
  const email = normalizeEmail(body.email);
  const name = String(body.name ?? '').trim();
  const role = String(body.role ?? 'staff').trim();

  if (!email) {
    const error = new Error('Email is required');
    error.status = 422;
    throw error;
  }

  if (!USER_ROLES.has(role)) {
    const error = new Error('Invalid role');
    error.status = 422;
    throw error;
  }

  return {email, name, role};
};

const getActiveOwnerCount = () =>
  prisma.user.count({
    where: {
      isActive: true,
      role: 'owner',
    },
  });

const ensureCanChangeOwnerStatus = async (user, {nextIsActive = user.isActive, nextRole = user.role} = {}) => {
  const demotesActiveOwner =
    user.role === 'owner' &&
    user.isActive &&
    (nextRole !== 'owner' || nextIsActive === false);

  if (!demotesActiveOwner) return;

  const activeOwnerCount = await getActiveOwnerCount();
  if (activeOwnerCount <= 1) {
    const error = new Error('Cannot remove the last active owner');
    error.status = 409;
    throw error;
  }
};

const auditUserAction = (req, {action, after = null, before = null, userId = null}) =>
  recordAuditLog(prisma, req, {
    action,
    after,
    before,
    entity: 'User',
    entityId: userId === null || userId === undefined ? null : String(userId),
  });

const logResetEmailFailure = (req, user, reason) =>
  recordErrorEvent(prisma, {
    context: {
      email: user.email,
      path: req.originalUrl,
      reason,
      smtpConfigured: isPasswordResetSmtpConfigured(),
      userId: user.id,
    },
    message: 'User reset email was not sent',
    severity: isPasswordResetSmtpConfigured() ? 'error' : 'critical',
    source: 'users.password-reset-email',
  });

const createAndSendResetToken = async (req, user) => {
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
    await recordErrorEvent(prisma, {
      context: {
        email: user.email,
        path: req.originalUrl,
        userId: user.id,
      },
      error,
      message: 'User reset email send failed',
      source: 'users.password-reset-email',
    });
  }

  await auditUserAction(req, {
    action: emailResult.sent ? 'user reset email sent' : 'user reset email failed',
    after: {
      email: user.email,
      emailStatus: emailResult.sent ? 'sent' : emailResult.reason,
      expiresAt,
      messageId: emailResult.messageId || null,
    },
    userId: user.id,
  });

  if (!emailResult.sent && isProduction()) {
    await logResetEmailFailure(req, user, emailResult.reason || 'email not sent');
  }

  return {
    emailResult,
    expiresAt,
    resetUrl: isProduction() ? null : resetUrl,
  };
};

const handleRouteError = async (req, res, error, context = {}) => {
  const status = error?.status || (error?.code === 'P2002' ? 409 : 500);
  const message =
    error?.code === 'P2002'
      ? 'User with this email already exists'
      : error?.message || 'Users API failed';

  if (status >= 500) {
    console.error('Users API error:', error);
    await recordErrorEvent(prisma, {
      context: {
        ...context,
        path: req.originalUrl,
      },
      error,
      message,
      source: 'users',
    });
  }

  res.status(status).json({success: false, error: message});
};

router.use(requireOwner);

router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: [{role: 'asc'}, {createdAt: 'asc'}],
      select: USER_SELECT,
    });

    res.json({success: true, users: users.map(serializeUser)});
  } catch (error) {
    await handleRouteError(req, res, error);
  }
});

router.post('/users', async (req, res) => {
  try {
    const {email, name, role} = parseUserPayload(req.body);
    const temporaryPassword = createStrongTemporaryPassword();
    const strength = validatePasswordStrength(temporaryPassword, {email, role});

    if (!strength.isValid) {
      const error = new Error('Temporary password generation failed');
      error.status = 500;
      throw error;
    }

    const passwordHash = await hashPassword(temporaryPassword);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordChangedAt: null,
        passwordHash,
        role,
      },
      select: USER_SELECT,
    });

    await auditUserAction(req, {
      action: 'user created',
      after: serializeUser(user),
      userId: user.id,
    });

    const reset = await createAndSendResetToken(req, user);

    res.status(201).json({
      success: true,
      user: serializeUser(user),
      resetEmailSent: Boolean(reset.emailResult.sent),
      resetUrl: reset.resetUrl,
    });
  } catch (error) {
    await handleRouteError(req, res, error, {action: 'create user'});
  }
});

router.put('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(422).json({success: false, error: 'Invalid user id'});
  }

  try {
    const current = await prisma.user.findUnique({where: {id}, select: USER_SELECT});
    if (!current) {
      return res.status(404).json({success: false, error: 'User not found'});
    }

    const {email, name, role} = parseUserPayload({
      email: req.body?.email ?? current.email,
      name: req.body?.name ?? current.name,
      role: req.body?.role ?? current.role,
    });

    const nextIsActive =
      typeof req.body?.isActive === 'boolean' ? req.body.isActive : current.isActive;

    await ensureCanChangeOwnerStatus(current, {nextIsActive, nextRole: role});

    const updated = await prisma.user.update({
      data: {
        email,
        isActive: nextIsActive,
        name,
        role,
      },
      where: {id},
      select: USER_SELECT,
    });

    await auditUserAction(req, {
      action: 'user updated',
      after: serializeUser(updated),
      before: serializeUser(current),
      userId: id,
    });

    res.json({success: true, user: serializeUser(updated)});
  } catch (error) {
    await handleRouteError(req, res, error, {action: 'update user', userId: id});
  }
});

router.post('/users/:id/disable', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(422).json({success: false, error: 'Invalid user id'});
  }

  try {
    const current = await prisma.user.findUnique({where: {id}, select: USER_SELECT});
    if (!current) {
      return res.status(404).json({success: false, error: 'User not found'});
    }

    await ensureCanChangeOwnerStatus(current, {nextIsActive: false});

    const updated = await prisma.user.update({
      data: {isActive: false},
      where: {id},
      select: USER_SELECT,
    });

    await auditUserAction(req, {
      action: 'user disabled',
      after: serializeUser(updated),
      before: serializeUser(current),
      userId: id,
    });

    res.json({success: true, user: serializeUser(updated)});
  } catch (error) {
    await handleRouteError(req, res, error, {action: 'disable user', userId: id});
  }
});

router.post('/users/:id/enable', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(422).json({success: false, error: 'Invalid user id'});
  }

  try {
    const current = await prisma.user.findUnique({where: {id}, select: USER_SELECT});
    if (!current) {
      return res.status(404).json({success: false, error: 'User not found'});
    }

    const updated = await prisma.user.update({
      data: {isActive: true},
      where: {id},
      select: USER_SELECT,
    });

    await auditUserAction(req, {
      action: 'user enabled',
      after: serializeUser(updated),
      before: serializeUser(current),
      userId: id,
    });

    res.json({success: true, user: serializeUser(updated)});
  } catch (error) {
    await handleRouteError(req, res, error, {action: 'enable user', userId: id});
  }
});

router.post('/users/:id/send-reset', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(422).json({success: false, error: 'Invalid user id'});
  }

  try {
    const user = await prisma.user.findUnique({where: {id}, select: USER_SELECT});
    if (!user) {
      return res.status(404).json({success: false, error: 'User not found'});
    }

    if (!user.isActive) {
      return res.status(409).json({success: false, error: 'Cannot send reset to disabled user'});
    }

    const reset = await createAndSendResetToken(req, user);

    res.json({
      success: true,
      resetEmailSent: Boolean(reset.emailResult.sent),
      resetUrl: reset.resetUrl,
    });
  } catch (error) {
    await handleRouteError(req, res, error, {action: 'send user reset', userId: id});
  }
});

module.exports = router;
