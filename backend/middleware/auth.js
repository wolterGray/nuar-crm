const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { getEffectivePermissions, PERMISSIONS } = require('../constants/permissions');

let defaultPrisma = null;
function getPrisma() {
  if (!defaultPrisma) {
    defaultPrisma = new PrismaClient();
  }
  return defaultPrisma;
}

// In-memory cache for active user lookups (10s TTL)
const userCache = new Map();
const CACHE_TTL_MS = 10000;

function invalidateUserCache(userId) {
  if (userId !== undefined && userId !== null) {
    userCache.delete(Number(userId));
    userCache.delete(String(userId));
  } else {
    userCache.clear();
  }
}

const isOwnerAuth = (auth = {}) => {
  return (
    auth?.role === 'owner' ||
    auth?.sub === 'local-admin' ||
    auth?.id === 'local-admin'
  );
};

const hasPermission = (auth, permissionKey) => {
  if (!auth) return false;
  if (isOwnerAuth(auth) || auth.role === 'owner') return true;
  const effective = auth.effectivePermissions || getEffectivePermissions(auth.role, auth.permissions);
  return Boolean(effective[permissionKey]);
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

function requireAdminOrOwner(req, res, next) {
  if (isOwnerAuth(req.auth) || req.auth?.role === 'admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Admin or owner role required',
  });
}

function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (hasPermission(req.auth, permissionKey)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Доступ запрещён: требуется право '${permissionKey}'`,
    });
  };
}

function getEffectiveAuth(decoded, dbUser = null) {
  const role = dbUser?.role || decoded?.role || 'unknown';
  const employeeId = dbUser ? dbUser.employeeId : (decoded?.employeeId ? Number(decoded.employeeId) : null);
  const permissions = (dbUser?.permissions && typeof dbUser.permissions === 'object')
    ? dbUser.permissions
    : ((decoded?.permissions && typeof decoded.permissions === 'object') ? decoded.permissions : {});

  return {
    ...decoded,
    id: String(dbUser?.id || decoded?.sub || decoded?.id || ''),
    email: dbUser?.email || decoded?.email,
    name: dbUser?.name || decoded?.name || '',
    role,
    isActive: dbUser ? dbUser.isActive : (decoded?.isActive !== false),
    employeeId,
    permissions,
    effectivePermissions: getEffectivePermissions(role, permissions),
  };
}

function verifyJwt(req, res, next) {
  const authHeader = req.headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing Authorization header' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');
    const decoded = jwt.verify(token, secret);
    req.auth = getEffectiveAuth(decoded);
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid JWT' });
  }
}

/**
 * Middleware that validates user is active in DB, checks for password rotation,
 * and enriches req.auth with current permissions and linked employeeId.
 */
function createActiveUserMiddleware(prismaClient = null) {
  return async function requireActiveUser(req, res, next) {
    if (!req.auth) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const rawId = req.auth.sub || req.auth.id;
    const numericId = Number(rawId);
    const db = prismaClient || req.prisma || req.app?.get?.('prisma') || getPrisma();

    // Check emergency local-admin: only permitted if database has 0 active owners
    if (rawId === 'local-admin') {
      try {
        const ownerCount = await db.user.count({
          where: { isActive: true, role: 'owner' },
        });
        if (ownerCount > 0) {
          return res.status(401).json({
            success: false,
            error: 'Emergency local-admin is disabled when database owners exist',
          });
        }
        return next();
      } catch {
        if (process.env.NODE_ENV === 'production') {
          return res.status(500).json({ success: false, error: 'Authentication verification failed' });
        }
        return next();
      }
    }

    if (!Number.isInteger(numericId) || numericId <= 0) {
      return res.status(401).json({ success: false, error: 'Invalid user ID in token' });
    }

    const cached = userCache.get(numericId);
    if (cached && cached.expiresAt > Date.now()) {
      if (!cached.user.isActive) {
        return res.status(401).json({ success: false, error: 'User is inactive or disabled' });
      }
      if (cached.user.passwordChangedAt && req.auth.iat) {
        const changedSec = Math.floor(new Date(cached.user.passwordChangedAt).getTime() / 1000);
        if (req.auth.iat < changedSec) {
          return res.status(401).json({ success: false, error: 'Password changed, please log in again' });
        }
      }
      req.auth = getEffectiveAuth(req.auth, cached.user);
      return next();
    }

    try {
      const dbUser = await db.user.findUnique({
        where: { id: numericId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          employeeId: true,
          permissions: true,
          passwordChangedAt: true,
        },
      });

      if (!dbUser) {
        return res.status(401).json({ success: false, error: 'User account not found' });
      }

      if (!dbUser.isActive) {
        userCache.set(numericId, { user: dbUser, expiresAt: Date.now() + CACHE_TTL_MS });
        return res.status(401).json({ success: false, error: 'User is inactive or disabled' });
      }

      if (dbUser.passwordChangedAt && req.auth.iat) {
        const changedSec = Math.floor(new Date(dbUser.passwordChangedAt).getTime() / 1000);
        if (req.auth.iat < changedSec) {
          return res.status(401).json({ success: false, error: 'Password changed, please log in again' });
        }
      }

      userCache.set(numericId, { user: dbUser, expiresAt: Date.now() + CACHE_TTL_MS });
      req.auth = getEffectiveAuth(req.auth, dbUser);
      return next();
    } catch (err) {
      // In production, DB down is critical; in dev/test without DB, proceed with token claims
      if (process.env.NODE_ENV === 'production') {
        console.error('requireActiveUser DB lookup error:', err);
        return res.status(500).json({ success: false, error: 'Authentication verification failed' });
      }
      return next();
    }
  };
}

const requireActiveUser = createActiveUserMiddleware();

module.exports = {
  createActiveUserMiddleware,
  getEffectiveAuth,
  hasPermission,
  invalidateUserCache,
  isOwnerAuth,
  requireActiveUser,
  requireAdminOrOwner,
  requireOwner,
  requirePermission,
  verifyJwt,
  PERMISSIONS,
};
