const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const { ensureSiteCmsTables } = require('../utils/siteCmsTables');

const router = express.Router();
const prisma = new PrismaClient();
const SITE_CONTENT_ROW_ID = 'main';

const handleRouteError = (res, error) => {
  const response = getHttpErrorResponse(error);
  console.error('Public site API error:', error);
  res.status(response.status).json({ success: false, error: response.message });
};

router.get('/site-content', async (_req, res) => {
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
    handleRouteError(res, error);
  }
});

router.get('/site-images', async (req, res) => {
  const ids = String(req.query.ids ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!ids.length) {
    return res.json({ success: true, data: [] });
  }

  try {
    await ensureSiteCmsTables(prisma);
    const rows = await prisma.$queryRaw`
      select id, mime_type, data_base64, thumb_mime_type, thumb_base64
      from site_images
      where id = any(${ids})
    `;
    res.json({ success: true, data: rows ?? [] });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
