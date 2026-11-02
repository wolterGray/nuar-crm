const express = require('express');
const {PrismaClient} = require('@prisma/client');
const {requirePermission, PERMISSIONS} = require('../middleware/auth');
const {buildAuditLogWhere, parseAuditLogQuery} = require('../domain/auditLogQuery');

const router = express.Router();
const prisma = new PrismaClient();

router.get('/audit-logs', requirePermission(PERMISSIONS.LOGS_VIEW), async (req, res, next) => {
  try {
    const filters = parseAuditLogQuery(req.query);
    const records = await prisma.auditLog.findMany({
      where: buildAuditLogWhere(filters),
      orderBy: {id: 'desc'},
      take: filters.limit + 1,
    });
    const hasMore = records.length > filters.limit;
    const items = records.slice(0, filters.limit);
    const numericActorIds = [...new Set(items
      .map((item) => Number(item.actorId))
      .filter((id) => Number.isInteger(id) && id > 0))];
    const users = numericActorIds.length
      ? await prisma.user.findMany({
          where: {id: {in: numericActorIds}},
          select: {email: true, id: true, name: true},
        })
      : [];
    const usersById = new Map(users.map((user) => [String(user.id), user]));

    res.json({
      items: items.map((item) => ({
        ...item,
        actor: usersById.get(String(item.actorId)) || null,
      })),
      nextCursor: hasMore ? String(items.at(-1)?.id || '') : null,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
