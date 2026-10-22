const express = require('express');
const {PrismaClient} = require('@prisma/client');
const {requireAdminOrOwner, isOwnerAuth, invalidateUserCache} = require('../middleware/auth');
const {PERMISSION_GROUPS} = require('../constants/permissions');
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
  createStrongTemporaryPassword,
  hashPassword,
  normalizeEmail,
  validatePasswordStrength,
} = require('../utils/passwordAuth');

const USER_ROLES = new Set(['owner', 'admin', 'manager', 'staff', 'readonly']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USER_SELECT = {
  createdAt: true,
  email: true,
  employeeId: true,
  id: true,
  isActive: true,
  lastLoginAt: true,
  name: true,
  permissions: true,
  role: true,
  updatedAt: true,
  employee: {
    select: {
      id: true,
      name: true,
      role: true,
    },
  },
};

const serializeUser = (user) => ({
  createdAt: user.createdAt,
  email: user.email,
  employeeId: user.employeeId || null,
  employeeName: user.employee?.name || null,
  employee: user.employee ? { id: user.employee.id, name: user.employee.name, role: user.employee.role } : null,
  id: user.id,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  name: user.name || '',
  permissions: (user.permissions && typeof user.permissions === 'object') ? user.permissions : {},
  role: user.role,
  updatedAt: user.updatedAt,
});

const parseUserPayload = (body = {}) => {
  const email = normalizeEmail(body.email);
  const name = String(body.name ?? '').trim();
  const role = String(body.role ?? 'staff').trim().toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    const error = new Error('Укажите корректный email');
    error.status = 422;
    throw error;
  }

  if (!USER_ROLES.has(role)) {
    const error = new Error('Выбрана некорректная роль');
    error.status = 422;
    throw error;
  }

  const rawEmployeeId = body.employeeId !== undefined && body.employeeId !== null && String(body.employeeId).trim() !== ''
    ? Number(body.employeeId)
    : null;

  if (rawEmployeeId !== null && (!Number.isInteger(rawEmployeeId) || rawEmployeeId <= 0)) {
    const error = new Error('Некорректный ID сотрудника');
    error.status = 422;
    throw error;
  }

  const permissions =
    body.permissions && typeof body.permissions === 'object' && !Array.isArray(body.permissions)
      ? body.permissions
      : undefined;

  return { email, name, role, employeeId: rawEmployeeId, permissions };
};

function createUsersRouter({
  prismaClient = new PrismaClient(),
  sendResetEmail = sendPasswordResetEmail,
  checkSmtpConfigured = isPasswordResetSmtpConfigured,
} = {}) {
  const router = express.Router();
  const prisma = prismaClient;

  const getActiveOwnerCount = () =>
    prisma.user.count({
      where: {
        isActive: true,
        role: 'owner',
      },
    });

  const ensureCanChangeOwnerStatus = async (
    user,
    {nextIsActive = user.isActive, nextRole = user.role} = {},
  ) => {
    const demotesActiveOwner =
      user.role === 'owner' &&
      user.isActive &&
      (nextRole !== 'owner' || nextIsActive === false);

    if (!demotesActiveOwner) return;

    const activeOwnerCount = await getActiveOwnerCount();
    if (activeOwnerCount <= 1) {
      const error = new Error('Нельзя отключить или понизить единственного активного владельца');
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
        smtpConfigured: checkSmtpConfigured(),
        userId: user.id,
      },
      message: 'User reset email was not sent',
      severity: checkSmtpConfigured() ? 'error' : 'critical',
      source: 'users.password-reset-email',
    });

  const createAndSendResetToken = async (req, user) => {
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

    let emailResult;
    try {
      emailResult = await sendResetEmail({email: user.email, resetUrl});
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
      smtpConfigured: Boolean(checkSmtpConfigured()),
      resetUrl,
    };
  };

  const handleRouteError = async (req, res, error, context = {}) => {
    const status = error?.status || (error?.code === 'P2002' ? 409 : 500);
    const message =
      error?.code === 'P2002'
        ? (error?.meta?.target?.includes?.('employeeId')
            ? 'Этот сотрудник уже привязан к другому пользователю'
            : 'Пользователь с таким email уже существует')
        : error?.message || 'Ошибка управления доступами';

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

  router.use(requireAdminOrOwner);

  const ensureAdminDoesNotManageOwner = (req, targetRole) => {
    if (!isOwnerAuth(req.auth) && targetRole === 'owner') {
      const error = new Error('Только владелец может управлять аккаунтом владельца');
      error.status = 403;
      throw error;
    }
  };

  router.get('/users', async (req, res) => {
    try {
      const [users, employees] = await Promise.all([
        prisma.user.findMany({
          orderBy: [{role: 'asc'}, {createdAt: 'asc'}],
          select: USER_SELECT,
        }),
        prisma.employee
          ? prisma.employee.findMany({
              orderBy: {name: 'asc'},
              select: {id: true, name: true, role: true, email: true, status: true},
            })
          : Promise.resolve([]),
      ]);

      res.json({
        success: true,
        smtpConfigured: Boolean(checkSmtpConfigured()),
        users: users.map(serializeUser),
        employees: (employees || []).map((emp) => ({
          id: emp.id,
          name: emp.name,
          role: emp.role,
          status: emp.status,
        })),
        permissionGroups: PERMISSION_GROUPS,
      });
    } catch (error) {
      await handleRouteError(req, res, error);
    }
  });

  router.post('/users', async (req, res) => {
    try {
      const {email, name, role, employeeId, permissions} = parseUserPayload(req.body);

      // Non-owners cannot create an owner
      if (role === 'owner' && !isOwnerAuth(req.auth)) {
        const error = new Error('Только владелец может назначать роль владельца');
        error.status = 403;
        throw error;
      }

      if (employeeId && prisma.user.findUnique) {
        const existingEmployeeUser = await prisma.user.findUnique({
          where: { employeeId },
        });
        if (existingEmployeeUser) {
          const error = new Error('Этот сотрудник уже привязан к другому пользователю');
          error.status = 409;
          throw error;
        }
      }

      const temporaryPassword = createStrongTemporaryPassword({email, role});
      const strength = validatePasswordStrength(temporaryPassword, {email, role});

      if (!strength.ok || !strength.isValid) {
        const error = new Error('Не удалось сгенерировать безопасный временный пароль');
        error.status = 500;
        throw error;
      }

      const passwordHash = await hashPassword(temporaryPassword);
      const user = await prisma.user.create({
        data: {
          email,
          employeeId: employeeId || null,
          name,
          passwordChangedAt: null,
          passwordHash,
          permissions: permissions || {},
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
        smtpConfigured: Boolean(reset.smtpConfigured),
        resetUrl: reset.resetUrl,
      });
    } catch (error) {
      await handleRouteError(req, res, error, {action: 'create user'});
    }
  });

  router.put('/users/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(422).json({success: false, error: 'Некорректный ID пользователя'});
    }

    try {
      const current = await prisma.user.findUnique({where: {id}, select: USER_SELECT});
      if (!current) {
        return res.status(404).json({success: false, error: 'Пользователь не найден'});
      }

      ensureAdminDoesNotManageOwner(req, current.role);

      const {email, name, role, employeeId, permissions} = parseUserPayload({
        email: req.body?.email ?? current.email,
        employeeId: req.body?.employeeId !== undefined ? req.body.employeeId : current.employeeId,
        name: req.body?.name ?? current.name,
        permissions: req.body?.permissions !== undefined ? req.body.permissions : current.permissions,
        role: req.body?.role ?? current.role,
      });

      const nextIsActive =
        typeof req.body?.isActive === 'boolean' ? req.body.isActive : current.isActive;

      // Anti-self-escalation: users cannot change own role, permissions, employeeId, or deactivate themselves
      const isEditingSelf = String(req.auth?.id) === String(id);
      if (isEditingSelf) {
        if (role !== current.role) {
          const error = new Error('Нельзя изменить собственную роль');
          error.status = 403;
          throw error;
        }
        if (permissions !== undefined && JSON.stringify(permissions) !== JSON.stringify(current.permissions || {})) {
          const error = new Error('Нельзя изменить собственные права доступа');
          error.status = 403;
          throw error;
        }
        if (employeeId !== current.employeeId) {
          const error = new Error('Нельзя изменить собственную привязку к мастеру');
          error.status = 403;
          throw error;
        }
        if (nextIsActive === false) {
          const error = new Error('Нельзя отключить собственный аккаунт');
          error.status = 403;
          throw error;
        }
      }

      // Non-owners cannot promote someone to owner
      if (!isOwnerAuth(req.auth) && role === 'owner' && current.role !== 'owner') {
        const error = new Error('Только владелец может назначать роль владельца');
        error.status = 403;
        throw error;
      }

      // Check unique employee binding
      if (employeeId && employeeId !== current.employeeId && prisma.user.findUnique) {
        const existingEmployeeUser = await prisma.user.findUnique({
          where: { employeeId },
        });
        if (existingEmployeeUser && existingEmployeeUser.id !== id) {
          const error = new Error('Этот сотрудник уже привязан к другому пользователю');
          error.status = 409;
          throw error;
        }
      }

      await ensureCanChangeOwnerStatus(current, {nextIsActive, nextRole: role});

      const updated = await prisma.user.update({
        data: {
          email,
          employeeId: employeeId !== undefined ? employeeId : current.employeeId,
          isActive: nextIsActive,
          name,
          permissions: permissions !== undefined ? permissions : current.permissions,
          role,
        },
        where: {id},
        select: USER_SELECT,
      });

      invalidateUserCache(id);

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
      return res.status(422).json({success: false, error: 'Некорректный ID пользователя'});
    }

    try {
      const current = await prisma.user.findUnique({where: {id}, select: USER_SELECT});
      if (!current) {
        return res.status(404).json({success: false, error: 'Пользователь не найден'});
      }


      ensureAdminDoesNotManageOwner(req, current.role);

      await ensureCanChangeOwnerStatus(current, {nextIsActive: false});

      if (String(req.auth?.id) === String(id)) {
        return res.status(403).json({success: false, error: 'Нельзя отключить собственный аккаунт'});
      }

      const updated = await prisma.user.update({
        data: {isActive: false},
        where: {id},
        select: USER_SELECT,
      });

      invalidateUserCache(id);

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
      return res.status(422).json({success: false, error: 'Некорректный ID пользователя'});
    }

    try {
      const current = await prisma.user.findUnique({where: {id}, select: USER_SELECT});
      if (!current) {
        return res.status(404).json({success: false, error: 'Пользователь не найден'});
      }


      ensureAdminDoesNotManageOwner(req, current.role);

      const updated = await prisma.user.update({
        data: {isActive: true},
        where: {id},
        select: USER_SELECT,
      });

      invalidateUserCache(id);

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
      return res.status(422).json({success: false, error: 'Некорректный ID пользователя'});
    }

    try {
      const user = await prisma.user.findUnique({where: {id}, select: USER_SELECT});
      if (!user) {
        return res.status(404).json({success: false, error: 'Пользователь не найден'});
      }


      ensureAdminDoesNotManageOwner(req, user.role);

      if (!user.isActive) {
        return res.status(409).json({
          success: false,
          error: 'Нельзя отправить ссылку отключённому пользователю',
        });
      }

      const reset = await createAndSendResetToken(req, user);

      res.json({
        success: true,
        resetEmailSent: Boolean(reset.emailResult.sent),
        smtpConfigured: Boolean(reset.smtpConfigured),
        resetUrl: reset.resetUrl,
      });
    } catch (error) {
      await handleRouteError(req, res, error, {action: 'send user reset', userId: id});
    }
  });

  return router;
}

const defaultRouter = createUsersRouter();
defaultRouter.createUsersRouter = createUsersRouter;
defaultRouter.parseUserPayload = parseUserPayload;

module.exports = defaultRouter;
