const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { requirePermission, hasPermission, PERMISSIONS } = require('../middleware/auth');
const {resolveScopedEmployee, serviceIsAssignedToEmployee} = require('../utils/employeeScope');
const {
  respond,
  auditCreate,
  auditUpdate,
  auditDelete,
  cleanOptionalString,
  getRouteId,
  withStoredId,
} = require('../utils/crudHelpers');

const prisma = new PrismaClient();

const firstServiceVariant = (variants) => {
  if (!Array.isArray(variants)) {
    return null;
  }

  return (
    variants.find(
      (variant) =>
        Number(variant?.duration) > 0 || Number(variant?.price) > 0,
    ) ?? null
  );
};

const buildServiceData = (payload) => {
  const variants = Array.isArray(payload?.variants) ? payload.variants : [];
  const firstVariant = firstServiceVariant(variants);

  return {
    name: String(payload?.name ?? '').trim(),
    category: cleanOptionalString(payload?.category),
    description: cleanOptionalString(payload?.description),
    color: cleanOptionalString(payload?.color),
    variants,
    status: cleanOptionalString(payload?.status),
    bookingSettings: payload?.bookingSettings ?? null,
    buffers: {
      afterEnabled: payload?.siteBookingBufferAfterEnabled === true,
      afterMinutes: Math.max(0, Number(payload?.siteBookingBufferAfterMinutes) || 0),
      beforeEnabled: payload?.siteBookingBufferBeforeEnabled === true,
      beforeMinutes: Math.max(0, Number(payload?.siteBookingBufferBeforeMinutes) || 0),
    },
    siteVisible:
      typeof payload?.siteVisible === 'boolean'
        ? payload.siteVisible
        : typeof payload?.siteBookingEnabled === 'boolean'
          ? payload.siteBookingEnabled
          : null,
    price: firstVariant ? Number(firstVariant.price) || null : null,
    durationMin: firstVariant ? Number(firstVariant.duration) || null : null,
    sortOrder:
      payload?.sortOrder !== undefined && payload?.sortOrder !== null
        ? Number(payload.sortOrder) || 0
        : null,
    payload,
  };
};

const buildPackageData = (payload) => ({
  name: String(payload?.name ?? '').trim(),
  service: cleanOptionalString(payload?.service),
  visitsCount:
    payload?.visitsCount !== undefined && payload?.visitsCount !== null
      ? Number(payload.visitsCount) || 0
      : null,
  price:
    payload?.price !== undefined && payload?.price !== null
      ? Number(payload.price) || 0
      : null,
  validityDays:
    payload?.validityDays !== undefined && payload?.validityDays !== null
      ? Number(payload.validityDays) || 0
      : null,
  status: cleanOptionalString(payload?.status),
  active: payload?.active !== false,
  payload,
});

// ==================== Service ====================
router.post('/services', requirePermission(PERMISSIONS.CATALOG_MANAGE), (req, res) => {
  const data = buildServiceData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Service name is required' });
  }

  auditCreate(prisma, req, res, prisma.service.create({ data }).then(withStoredId), 'Service', 'create service');
});

router.patch('/services/reorder', requirePermission(PERMISSIONS.CATALOG_MANAGE), async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : [];

  if (ids.length === 0) {
    return res.status(400).json({ success: false, error: 'Service ids are required' });
  }

  try {
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.service.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    const records = await prisma.service.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });

    res.json({ success: true, data: records.map(withStoredId) });
  } catch (err) {
    console.error('Service reorder error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to reorder services' });
  }
});

router.get('/services/:id', requirePermission(PERMISSIONS.CATALOG_VIEW), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const service = await prisma.service.findUnique({where: {id}});
    if (!service) return res.status(404).json({success: false, error: 'Service not found'});
    if (!hasPermission(req.auth, PERMISSIONS.CALENDAR_VIEW_ALL)) {
      const employee = await resolveScopedEmployee(prisma, req.auth);
      if (!employee || !serviceIsAssignedToEmployee(service, employee)) {
        return res.status(403).json({success: false, error: 'Услуга не назначена этому сотруднику'});
      }
    }
    return res.json({success: true, data: withStoredId(service)});
  } catch (err) {
    return res.status(500).json({success: false, error: err.message});
  }
});

router.put('/services/:id', requirePermission(PERMISSIONS.CATALOG_MANAGE), async (req, res) => {
  const id = Number(req.params.id);
  const data = buildServiceData({ ...(req.body ?? {}), id });
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Service name is required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'service',
    id,
    prisma.service.update({ where: { id }, data }).then(withStoredId),
    'Service',
    'update service',
  );
});

router.delete('/services/:id', requirePermission(PERMISSIONS.CATALOG_MANAGE), async (req, res) => {
  const id = getRouteId(req, res);
  if (id === null) return;
  await auditDelete(
    prisma,
    req,
    res,
    'service',
    id,
    prisma.service.delete({ where: { id } }).then(withStoredId),
    'Service',
    'delete service',
  );
});

router.get('/services', requirePermission(PERMISSIONS.CATALOG_VIEW), async (req, res) => {
  try {
    const records = await prisma.service.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
    if (hasPermission(req.auth, PERMISSIONS.CALENDAR_VIEW_ALL)) {
      return res.json({success: true, data: records.map(withStoredId)});
    }
    const employee = await resolveScopedEmployee(prisma, req.auth);
    const visible = employee ? records.filter((service) => serviceIsAssignedToEmployee(service, employee)) : [];
    return res.json({success: true, data: visible.map(withStoredId)});
  } catch (err) {
    console.error('Service list error:', err);
    return res.status(500).json({success: false, error: err.message});
  }
});

// ==================== Package ====================
router.post('/packages', requirePermission(PERMISSIONS.CATALOG_MANAGE), (req, res) => {
  const data = buildPackageData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Package name is required' });
  }

  auditCreate(prisma, req, res, prisma.package.create({ data }).then(withStoredId), 'Package', 'create package');
});

router.get('/packages/:id', requirePermission(PERMISSIONS.CATALOG_VIEW), (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.package.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/packages/:id', requirePermission(PERMISSIONS.CATALOG_MANAGE), async (req, res) => {
  const id = Number(req.params.id);
  const data = buildPackageData({ ...(req.body ?? {}), id });
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Package name is required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'package',
    id,
    prisma.package.update({ where: { id }, data }).then(withStoredId),
    'Package',
    'update package',
  );
});

router.delete('/packages/:id', requirePermission(PERMISSIONS.CATALOG_MANAGE), async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    prisma,
    req,
    res,
    'package',
    id,
    prisma.package.delete({ where: { id } }).then(withStoredId),
    'Package',
    'delete package',
  );
});

router.get('/packages', requirePermission(PERMISSIONS.CATALOG_VIEW), (req, res) => {
  respond(res, prisma.package.findMany({ orderBy: { name: 'asc' } }).then((records) => records.map(withStoredId)));
});

module.exports = router;
