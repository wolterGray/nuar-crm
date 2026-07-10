const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireOwner } = require('../middleware/auth');
const { recordAuditLog, recordErrorEvent } = require('../services/loggingService');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const { ensureSiteCmsTables } = require('../utils/siteCmsTables');

const router = express.Router();
const prisma = new PrismaClient();
const SITE_CONTENT_ROW_ID = 'main';

const validationError = (message) => {
  const error = new Error(message);
  error.status = 422;
  return error;
};

const sanitizeFolder = (folder = 'uploads') =>
  String(folder).replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'uploads';

const normalizeLimit = (value, fallback = 60) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return Math.min(number, 200);
};

function deepMerge(target, source) {
  if (typeof target !== 'object' || target === null) return source;
  if (typeof source !== 'object' || source === null) return source;
  if (Array.isArray(target) || Array.isArray(source)) return source;

  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && key in target) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

const handleRouteError = async (req, res, error, context = {}) => {
  const response = getHttpErrorResponse(error);
  console.error('Site CMS API error:', error);
  await recordErrorEvent(prisma, {
    context: {
      ...context,
      path: req.originalUrl,
    },
    error,
    message: error.message,
    source: 'site-cms',
  });
  res.status(response.status).json({ success: false, error: response.message });
};

router.get('/site-content', requireOwner, async (req, res) => {
  try {
    await ensureSiteCmsTables(prisma);
    const rows = await prisma.$queryRaw`
      select data, updated_at
      from site_content
      where id = ${SITE_CONTENT_ROW_ID}
      limit 1
    `;
    const row = rows?.[0] ?? null;
    res.json({
      success: true,
      data: {
        overrides: row?.data ?? {},
        updatedAt: row?.updated_at ?? null,
      },
    });
  } catch (error) {
    await handleRouteError(req, res, error);
  }
});

router.put('/site-content', requireOwner, async (req, res) => {
  const overrides = req.body?.overrides ?? req.body?.data;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return res.status(422).json({ success: false, error: 'CMS overrides object is required' });
  }

  try {
    await ensureSiteCmsTables(prisma);
    const overridesJson = JSON.stringify(overrides);
    const rows = await prisma.$queryRaw`
      insert into site_content (id, data, updated_at)
      values (${SITE_CONTENT_ROW_ID}, ${overridesJson}::jsonb, now())
      on conflict (id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at
      returning updated_at
    `;
    const updatedAt = rows?.[0]?.updated_at ?? new Date().toISOString();

    await recordAuditLog(prisma, req, {
      action: 'update site content',
      after: { updatedAt },
      before: null,
      entity: 'SiteContent',
      entityId: SITE_CONTENT_ROW_ID,
    });

    res.json({ success: true, data: { updatedAt } });
  } catch (error) {
    await handleRouteError(req, res, error);
  }
});

router.patch('/site-content', requireOwner, async (req, res) => {
  const patch = req.body?.overrides ?? req.body?.data ?? req.body;
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return res.status(422).json({ success: false, error: 'CMS overrides patch object is required' });
  }

  try {
    await ensureSiteCmsTables(prisma);
    
    // Получаем текущие данные
    const existingRows = await prisma.$queryRaw`
      select data from site_content
      where id = ${SITE_CONTENT_ROW_ID}
      limit 1
    `;
    const currentData = existingRows?.[0]?.data ?? {};
    
    // Выполняем глубокое слияние
    const mergedData = deepMerge(currentData, patch);
    const mergedJson = JSON.stringify(mergedData);
    
    const rows = await prisma.$queryRaw`
      insert into site_content (id, data, updated_at)
      values (${SITE_CONTENT_ROW_ID}, ${mergedJson}::jsonb, now())
      on conflict (id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at
      returning updated_at
    `;
    const updatedAt = rows?.[0]?.updated_at ?? new Date().toISOString();

    await recordAuditLog(prisma, req, {
      action: 'patch site content',
      after: { updatedAt },
      before: null,
      entity: 'SiteContent',
      entityId: SITE_CONTENT_ROW_ID,
    });

    res.json({ success: true, data: { updatedAt, overrides: mergedData } });
  } catch (error) {
    await handleRouteError(req, res, error);
  }
});

router.delete('/site-content', requireOwner, async (req, res) => {
  try {
    await ensureSiteCmsTables(prisma);
    const rows = await prisma.$queryRaw`
      insert into site_content (id, data, updated_at)
      values (${SITE_CONTENT_ROW_ID}, '{}'::jsonb, now())
      on conflict (id) do update
      set data = '{}'::jsonb,
          updated_at = excluded.updated_at
      returning updated_at
    `;
    const updatedAt = rows?.[0]?.updated_at ?? new Date().toISOString();

    await recordAuditLog(prisma, req, {
      action: 'clear site content',
      after: { updatedAt },
      before: null,
      entity: 'SiteContent',
      entityId: SITE_CONTENT_ROW_ID,
    });

    res.json({ success: true, data: { updatedAt } });
  } catch (error) {
    await handleRouteError(req, res, error);
  }
});

router.get('/site-images', requireOwner, async (req, res) => {
  const ids = String(req.query.ids ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const limit = normalizeLimit(req.query.limit);
  const folder = req.query.folder ? sanitizeFolder(req.query.folder) : null;

  try {
    await ensureSiteCmsTables(prisma);
    if (ids.length > 0) {
      const rows = await prisma.$queryRaw`
        select id, folder, mime_type, data_base64, size_bytes, thumb_mime_type,
               thumb_base64, thumb_size_bytes, updated_at
        from site_images
        where id = any(${ids})
      `;
      return res.json({ success: true, data: rows ?? [] });
    }

    const rows = folder
      ? await prisma.$queryRaw`
          select id, folder, mime_type, size_bytes, thumb_mime_type,
                 thumb_base64, thumb_size_bytes, updated_at
          from site_images
          where folder = ${folder}
          order by updated_at desc
          limit ${limit}
        `
      : await prisma.$queryRaw`
          select id, folder, mime_type, size_bytes, thumb_mime_type,
                 thumb_base64, thumb_size_bytes, updated_at
          from site_images
          order by updated_at desc
          limit ${limit}
        `;

    res.json({ success: true, data: rows ?? [] });
  } catch (error) {
    await handleRouteError(req, res, error, { idsCount: ids.length, folder, limit });
  }
});

router.get('/site-images/storage-usage', requireOwner, async (req, res) => {
  try {
    await ensureSiteCmsTables(prisma);
    const rows = await prisma.$queryRaw`
      select count(*)::int as count, coalesce(sum(size_bytes), 0)::int as bytes
      from site_images
    `;
    res.json({ success: true, data: rows?.[0] ?? { bytes: 0, count: 0 } });
  } catch (error) {
    await handleRouteError(req, res, error);
  }
});

router.put('/site-images/:id', requireOwner, async (req, res) => {
  const id = String(req.params.id ?? '').trim();
  const body = req.body ?? {};

  if (!id) {
    return res.status(422).json({ success: false, error: 'Image id is required' });
  }
  if (!body.mime_type || !body.data_base64) {
    return res.status(422).json({ success: false, error: 'Image payload is required' });
  }

  try {
    await ensureSiteCmsTables(prisma);
    const folder = sanitizeFolder(body.folder);
    const rows = await prisma.$queryRaw`
      insert into site_images (
        id, folder, mime_type, data_base64, size_bytes,
        thumb_mime_type, thumb_base64, thumb_size_bytes, updated_at
      )
      values (
        ${id}, ${folder}, ${body.mime_type}, ${body.data_base64}, ${Number(body.size_bytes) || 0},
        ${body.thumb_mime_type ?? null}, ${body.thumb_base64 ?? null},
        ${body.thumb_size_bytes === null || body.thumb_size_bytes === undefined ? null : Number(body.thumb_size_bytes) || 0},
        now()
      )
      on conflict (id) do update
      set folder = excluded.folder,
          mime_type = excluded.mime_type,
          data_base64 = excluded.data_base64,
          size_bytes = excluded.size_bytes,
          thumb_mime_type = excluded.thumb_mime_type,
          thumb_base64 = excluded.thumb_base64,
          thumb_size_bytes = excluded.thumb_size_bytes,
          updated_at = excluded.updated_at
      returning id, updated_at
    `;

    res.json({ success: true, data: rows?.[0] ?? { id } });
  } catch (error) {
    await handleRouteError(req, res, error, { id });
  }
});

router.patch('/site-images/:id', requireOwner, async (req, res) => {
  const id = String(req.params.id ?? '').trim();
  const body = req.body ?? {};

  if (!id) {
    return res.status(422).json({ success: false, error: 'Image id is required' });
  }

  try {
    await ensureSiteCmsTables(prisma);
    const existingRows = await prisma.$queryRaw`
      select id from site_images where id = ${id} limit 1
    `;
    if (!existingRows?.length) {
      throw validationError('Image not found');
    }

    await prisma.$executeRaw`
      update site_images
      set mime_type = coalesce(${body.mime_type ?? null}, mime_type),
          data_base64 = coalesce(${body.data_base64 ?? null}, data_base64),
          size_bytes = coalesce(${body.size_bytes === undefined ? null : Number(body.size_bytes) || 0}, size_bytes),
          thumb_mime_type = ${body.thumb_mime_type ?? null},
          thumb_base64 = ${body.thumb_base64 ?? null},
          thumb_size_bytes = ${body.thumb_size_bytes === undefined || body.thumb_size_bytes === null ? null : Number(body.thumb_size_bytes) || 0},
          updated_at = now()
      where id = ${id}
    `;

    res.json({ success: true, data: { id } });
  } catch (error) {
    await handleRouteError(req, res, error, { id });
  }
});

router.delete('/site-images', requireOwner, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter(Boolean) : [];
  if (!ids.length) return res.json({ success: true, data: { removed: 0 } });

  try {
    await ensureSiteCmsTables(prisma);
    const result = await prisma.$executeRaw`
      delete from site_images where id = any(${ids})
    `;
    res.json({ success: true, data: { removed: Number(result) || ids.length } });
  } catch (error) {
    await handleRouteError(req, res, error, { idsCount: ids.length });
  }
});

router.get('/site-images/orphans', requireOwner, async (req, res) => {
  try {
    await ensureSiteCmsTables(prisma);
    const rows = await prisma.$queryRaw`
      select id from site_images order by updated_at desc
    `;
    res.json({ success: true, data: rows ?? [] });
  } catch (error) {
    await handleRouteError(req, res, error);
  }
});

module.exports = router;
