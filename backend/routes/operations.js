const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { isOwnerAuth, requireOwner, requirePermission, hasPermission, PERMISSIONS } = require('../middleware/auth');
const { maskEmail, maskPhoneNumber } = require('../constants/permissions');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const {ensureNoteTables} = require('../utils/noteTables');
const {
  respond,
  auditCreate,
  auditUpdate,
  auditDelete,
  cleanOptionalString,
  withStoredId,
} = require('../utils/crudHelpers');

const prisma = new PrismaClient();
const NOTE_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
const NOTE_ATTACHMENT_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const isNote = (record) => String(record?.type ?? '').trim() === 'note';
const denyOwnerOnly = (res) => res.status(403).json({success: false, error: 'Owner role required'});
const cleanFileName = (value) => [...String(value ?? 'attachment')]
  .filter((character) => character.charCodeAt(0) >= 32)
  .join('')
  .replace(/[<>:"/\\|?*]+/g, '-')
  .trim()
  .slice(0, 180) || 'attachment';

const decodeBase64 = (value) => {
  const source = String(value ?? '').replace(/^data:[^;]+;base64,/, '');
  if (!source || !/^[a-z0-9+/=\r\n]+$/i.test(source)) return null;
  return Buffer.from(source, 'base64');
};

const notePayload = (value) => objectPayload(value?.payload ?? value);

const saveRevisionIfDue = async (tx, note) => {
  const latest = await tx.$queryRaw`
    select created_at
    from note_revisions
    where note_id = ${note.id}
    order by created_at desc
    limit 1
  `;
  const latestAt = latest?.[0]?.created_at ? new Date(latest[0].created_at).getTime() : 0;
  if (latestAt && Date.now() - latestAt < 10 * 60 * 1000) return;
  const payload = notePayload(note);
  await tx.$executeRaw`
    insert into note_revisions (note_id, title, content, priority, payload, version)
    values (
      ${note.id},
      ${note.title},
      ${note.note ?? note.description ?? null},
      ${note.priority ?? null},
      ${JSON.stringify(payload)}::jsonb,
      ${Number(payload.noteVersion) || 0}
    )
  `;
};

const toDate = (date) => {
  if (!date) return null;
  const value = new Date(date);
  return Number.isNaN(value.getTime()) ? null : value;
};

const objectPayload = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

const getTaskPlannerPayload = (value) => {
  const raw = objectPayload(value?.payload ?? value);
  const nested = objectPayload(raw.payload);
  return Object.keys(nested).length ? { ...raw, ...nested } : raw;
};

const buildTaskPayload = (payload) => {
  const explicitPayload = objectPayload(payload?.payload);
  return Object.keys(explicitPayload).length ? explicitPayload : objectPayload(payload);
};

const buildTaskData = (payload) => ({
  type: cleanOptionalString(payload?.type) || 'task',
  title: String(payload?.title ?? '').trim(),
  description: cleanOptionalString(payload?.description ?? payload?.note),
  note: cleanOptionalString(payload?.note),
  dueDate: toDate(payload?.dueDate),
  priority: cleanOptionalString(payload?.priority),
  status: cleanOptionalString(payload?.status),
  sortOrder:
    payload?.sortOrder !== undefined && payload?.sortOrder !== null
      ? Number(payload.sortOrder) || 0
      : null,
  completed:
    payload?.completed !== undefined
      ? Boolean(payload.completed)
      : payload?.status === 'completed',
  payload: buildTaskPayload(payload),
});

const clearOtherMainTasks = async (tx, savedTask) => {
  const savedPayload = getTaskPlannerPayload(savedTask);
  if (savedPayload.isMain !== true || !savedPayload.mainDate) return;

  const mainDate = String(savedPayload.mainDate);
  const assigneeId = String(savedPayload.assigneeId ?? '');
  const records = await tx.task.findMany({
    where: { id: { not: savedTask.id } },
    select: { id: true, payload: true },
  });
  const updates = records
    .filter((record) => {
      const payload = getTaskPlannerPayload(record);
      return (
        payload.isMain === true &&
        String(payload.mainDate ?? '') === mainDate &&
        String(payload.assigneeId ?? '') === assigneeId
      );
    })
    .map((record) => {
      const rawPayload = objectPayload(record.payload);
      const nestedPayload = objectPayload(rawPayload.payload);
      const nextPayload = Object.keys(nestedPayload).length
        ? { ...rawPayload, payload: { ...nestedPayload, isMain: false } }
        : { ...rawPayload, isMain: false };
      return tx.task.update({
        where: { id: record.id },
        data: { payload: nextPayload },
      });
    });

  await Promise.all(updates);
};

const createTaskWithMainGuard = (data) =>
  prisma.$transaction(async (tx) => {
    const savedTask = await tx.task.create({ data });
    await clearOtherMainTasks(tx, savedTask);
    return savedTask;
  });

const updateTaskWithMainGuard = (id, data) =>
  prisma.$transaction(async (tx) => {
    const savedTask = await tx.task.update({ where: { id }, data });
    await clearOtherMainTasks(tx, savedTask);
    return savedTask;
  });

const buildWaitlistEntryData = (payload) => ({
  clientId: payload?.clientId ? Number(payload.clientId) : null,
  clientName: cleanOptionalString(payload?.clientName),
  preferredDate: cleanOptionalString(payload?.preferredDate),
  preferredMaster: cleanOptionalString(payload?.preferredMaster),
  preferredService: cleanOptionalString(payload?.preferredService),
  preferredTimeFrom: cleanOptionalString(payload?.preferredTimeFrom),
  preferredTimeTo: cleanOptionalString(payload?.preferredTimeTo),
  status: cleanOptionalString(payload?.status) || 'active',
  note: cleanOptionalString(payload?.note),
  lastOfferedAt: payload?.lastOfferedAt ? new Date(payload.lastOfferedAt) : null,
  lastOfferedSlot: payload?.lastOfferedSlot ?? null,
  payload,
});

const buildSupplyData = (payload) => ({
  name: String(payload?.name ?? '').trim(),
  stock:
    payload?.stock !== undefined && payload?.stock !== null
      ? Number(payload.stock) || 0
      : null,
  minStock:
    payload?.minStock !== undefined && payload?.minStock !== null
      ? Number(payload.minStock) || 0
      : null,
  unit: cleanOptionalString(payload?.unit),
  cost:
    payload?.cost !== undefined && payload?.cost !== null
      ? Number(payload.cost) || 0
      : null,
  note: cleanOptionalString(payload?.note),
  orderUrl: cleanOptionalString(payload?.orderUrl),
  payload,
});

const buildMessageTemplateData = (payload) => ({
  name: String(payload?.name ?? '').trim(),
  channel: cleanOptionalString(payload?.channel),
  language: cleanOptionalString(payload?.language),
  audience: cleanOptionalString(payload?.audience),
  purpose: cleanOptionalString(payload?.purpose),
  subject: cleanOptionalString(payload?.subject),
  body: String(payload?.body ?? '').trim(),
  payload,
});

const buildCommunicationLogData = (payload) => ({
  clientId: payload?.clientId ? Number(payload.clientId) : null,
  clientName: cleanOptionalString(payload?.clientName),
  channel: cleanOptionalString(payload?.channel),
  templateName: cleanOptionalString(payload?.templateName),
  body: cleanOptionalString(payload?.body),
  createdAt: payload?.createdAt ? new Date(payload.createdAt) : undefined,
  payload,
});

// ==================== Operations state and messaging ====================
const sanitizeWaitlist = (entry, canViewContacts) => {
  const base = withStoredId(entry);
  if (canViewContacts || !base) return base;
  const p = base.payload && typeof base.payload === 'object' ? base.payload : {};
  return {
    ...base,
    phone: maskPhoneNumber(base.phone),
    payload: {
      ...p,
      phone: maskPhoneNumber(p.phone),
      email: maskEmail(p.email),
    },
  };
};

const sanitizeCommLog = (log, canViewContacts) => {
  const base = withStoredId(log);
  if (canViewContacts || !base) return base;
  const p = base.payload && typeof base.payload === 'object' ? base.payload : {};
  return {
    ...base,
    recipient: maskPhoneNumber(maskEmail(base.recipient)),
    phone: maskPhoneNumber(base.phone),
    payload: {
      ...p,
      recipient: maskPhoneNumber(maskEmail(p.recipient)),
      phone: maskPhoneNumber(p.phone),
      email: maskEmail(p.email),
    },
  };
};

router.get('/operations-state', async (req, res) => {
  try {
    const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
    const [
      tasks,
      supplies,
      waitlistEntries,
      messageTemplates,
      communicationLog,
    ] = await Promise.all([
      prisma.task
        .findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
      prisma.supply.findMany({ orderBy: { name: 'asc' } }),
      prisma.waitlistEntry.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.messageTemplate.findMany({ orderBy: { name: 'asc' } }),
      prisma.communicationLog.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);

    res.json({
      success: true,
      data: {
        communicationLog: communicationLog.map((l) => sanitizeCommLog(l, canViewContacts)),
        messageTemplates: messageTemplates.map(withStoredId),
        supplies: supplies.map(withStoredId),
        tasks: tasks
          .filter((task) => !isNote(task) || (isOwnerAuth(req.auth) && !notePayload(task).deletedAt))
          .map(withStoredId),
        waitlistEntries: waitlistEntries.map((w) => sanitizeWaitlist(w, canViewContacts)),
      },
    });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Operations state error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

// ==================== Task CRUD ====================
router.post('/tasks', requirePermission(PERMISSIONS.TASKS_MANAGE), (req, res) => {
  const data = buildTaskData(req.body ?? {});
  if (isNote(data) && !isOwnerAuth(req.auth)) return denyOwnerOnly(res);
  if (!data.title) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }

  auditCreate(prisma, req, res, createTaskWithMainGuard(data).then(withStoredId), 'Task', 'create task');
});

router.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.task.findUnique({ where: { id } }).then((task) => {
    if (isNote(task) && !isOwnerAuth(req.auth)) {
      const error = new Error('Owner role required');
      error.status = 403;
      throw error;
    }
    return withStoredId(task);
  }));
});

router.put('/tasks/:id', requirePermission(PERMISSIONS.TASKS_MANAGE), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.task.findUnique({where: {id}});
  if ((isNote(existing) || isNote(req.body)) && !isOwnerAuth(req.auth)) return denyOwnerOnly(res);
  const data = buildTaskData({ ...(req.body ?? {}), id });
  if (!data.title) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'task',
    id,
    updateTaskWithMainGuard(id, data).then(withStoredId),
    'Task',
    'update task',
  );
});

router.delete('/tasks/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.task.findUnique({where: {id}});
  if (isNote(existing)) {
    const payload = {...notePayload(existing), deletedAt: new Date().toISOString()};
    await auditUpdate(
      prisma,
      req,
      res,
      'task',
      id,
      prisma.task.update({where: {id}, data: {payload, status: 'deleted'}}).then(withStoredId),
      'Task',
      'move note to trash',
    );
    return;
  }
  await auditDelete(
    prisma,
    req,
    res,
    'task',
    id,
    prisma.task.delete({ where: { id } }).then(withStoredId),
    'Task',
    'delete task',
  );
});

router.get('/tasks', (req, res) => {
  respond(
    res,
    prisma.task
      .findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] })
      .then((records) => records
        .filter((task) => !isNote(task) || (isOwnerAuth(req.auth) && !notePayload(task).deletedAt))
        .map(withStoredId)),
  );
});

// ==================== Owner notes ====================
router.patch('/notes/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await ensureNoteTables(prisma);
    const saved = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findUnique({where: {id}});
      if (!existing || !isNote(existing)) {
        const error = new Error('Note not found');
        error.status = 404;
        throw error;
      }

      const currentPayload = notePayload(existing);
      const currentVersion = Number(currentPayload.noteVersion) || 0;
      const expectedVersion = Number(req.body?.expectedVersion);
      if (Number.isInteger(expectedVersion) && expectedVersion !== currentVersion) {
        const error = new Error('Note was changed on another device');
        error.status = 409;
        throw error;
      }

      await saveRevisionIfDue(tx, existing);
      const incomingPayload = objectPayload(req.body?.payload);
      const nextPayload = {
        ...currentPayload,
        ...incomingPayload,
        lastEditedAt: new Date().toISOString(),
        noteVersion: currentVersion + 1,
      };
      const content = req.body?.note ?? req.body?.description ?? existing.note ?? existing.description;
      return tx.task.update({
        where: {id},
        data: {
          description: content,
          note: content,
          payload: nextPayload,
          priority: req.body?.priority ?? existing.priority,
          title: String(req.body?.title ?? existing.title).trim() || existing.title,
        },
      });
    });
    res.json({success: true, data: withStoredId(saved)});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.get('/notes-trash', requireOwner, async (_req, res) => {
  try {
    const notes = await prisma.task.findMany({where: {type: 'note'}, orderBy: {updatedAt: 'desc'}});
    res.json({success: true, data: notes.filter((note) => Boolean(notePayload(note).deletedAt)).map(withStoredId)});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/notes/:id/restore', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.task.findUnique({where: {id}});
    if (!existing || !isNote(existing)) return res.status(404).json({success: false, error: 'Note not found'});
    const payload = {...notePayload(existing)};
    delete payload.deletedAt;
    const saved = await prisma.task.update({where: {id}, data: {payload, status: 'active'}});
    res.json({success: true, data: withStoredId(saved)});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.delete('/notes/:id/permanent', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.task.findUnique({where: {id}});
    if (!existing || !isNote(existing) || !notePayload(existing).deletedAt) {
      return res.status(404).json({success: false, error: 'Deleted note not found'});
    }
    await prisma.task.delete({where: {id}});
    res.json({success: true, data: {id}});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.get('/notes/:id/revisions', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await ensureNoteTables(prisma);
    const rows = await prisma.$queryRaw`
      select id, note_id, title, content, priority, version, created_at
      from note_revisions
      where note_id = ${id}
      order by created_at desc
      limit 50
    `;
    res.json({
      success: true,
      data: rows.map((row) => ({...row, id: String(row.id)})),
    });
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/notes/:id/revisions/:revisionId/restore', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const revisionId = BigInt(req.params.revisionId);
    await ensureNoteTables(prisma);
    const saved = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findUnique({where: {id}});
      if (!existing || !isNote(existing)) {
        const error = new Error('Note not found');
        error.status = 404;
        throw error;
      }
      const revisions = await tx.$queryRaw`
        select title, content, priority, payload
        from note_revisions
        where id = ${revisionId} and note_id = ${id}
        limit 1
      `;
      const revision = revisions?.[0];
      if (!revision) {
        const error = new Error('Revision not found');
        error.status = 404;
        throw error;
      }
      await saveRevisionIfDue(tx, existing);
      const currentVersion = Number(notePayload(existing).noteVersion) || 0;
      return tx.task.update({
        where: {id},
        data: {
          description: revision.content,
          note: revision.content,
          payload: {...objectPayload(revision.payload), noteVersion: currentVersion + 1, lastEditedAt: new Date().toISOString()},
          priority: revision.priority,
          title: revision.title,
        },
      });
    });
    res.json({success: true, data: withStoredId(saved)});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.get('/notes/:id/attachments', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  try {
    await ensureNoteTables(prisma);
    const rows = await prisma.$queryRaw`
      select id, note_id, file_name, mime_type, size_bytes, created_at
      from note_attachments
      where note_id = ${id}
      order by created_at asc
    `;
    res.json({success: true, data: rows});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/notes/:id/attachments', requireOwner, async (req, res) => {
  const noteId = Number(req.params.id);
  const mimeType = String(req.body?.mimeType ?? '').toLowerCase();
  const data = decodeBase64(req.body?.dataBase64);
  if (!NOTE_ATTACHMENT_TYPES.has(mimeType)) {
    return res.status(422).json({success: false, error: 'Unsupported attachment type'});
  }
  if (!data?.length || data.length > NOTE_ATTACHMENT_MAX_BYTES) {
    return res.status(422).json({success: false, error: 'Attachment must be smaller than 8 MB'});
  }
  try {
    await ensureNoteTables(prisma);
    const note = await prisma.task.findUnique({where: {id: noteId}});
    if (!note || !isNote(note)) return res.status(404).json({success: false, error: 'Note not found'});
    const id = crypto.randomUUID();
    const fileName = cleanFileName(req.body?.fileName);
    const rows = await prisma.$queryRaw`
      insert into note_attachments (id, note_id, file_name, mime_type, size_bytes, data)
      values (${id}, ${noteId}, ${fileName}, ${mimeType}, ${data.length}, ${data})
      returning id, note_id, file_name, mime_type, size_bytes, created_at
    `;
    res.status(201).json({success: true, data: rows[0]});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.get('/notes/attachments/:attachmentId/content', requireOwner, async (req, res) => {
  try {
    await ensureNoteTables(prisma);
    const rows = await prisma.$queryRaw`
      select file_name, mime_type, data
      from note_attachments
      where id = ${String(req.params.attachmentId)}
      limit 1
    `;
    const attachment = rows?.[0];
    if (!attachment) return res.status(404).json({success: false, error: 'Attachment not found'});
    res.set('Content-Type', attachment.mime_type);
    res.set('Content-Disposition', `inline; filename="${cleanFileName(attachment.file_name)}"`);
    res.set('Cache-Control', 'private, max-age=300');
    return res.send(attachment.data);
  } catch (error) {
    const response = getHttpErrorResponse(error);
    return res.status(response.status).json({success: false, error: response.message});
  }
});

router.delete('/notes/attachments/:attachmentId', requireOwner, async (req, res) => {
  try {
    await ensureNoteTables(prisma);
    const count = await prisma.$executeRaw`
      delete from note_attachments where id = ${String(req.params.attachmentId)}
    `;
    res.json({success: true, data: {deleted: Number(count)}});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

// ==================== Waitlist CRUD ====================
router.post('/waitlist', (req, res) => {
  const data = buildWaitlistEntryData(req.body ?? {});
  if (!data.clientName) {
    return res.status(400).json({ success: false, error: 'Waitlist client name is required' });
  }

  auditCreate(
    prisma,
    req,
    res,
    prisma.waitlistEntry.create({ data }).then(withStoredId),
    'WaitlistEntry',
    'create waitlist entry',
  );
});

router.get('/waitlist/:id', async (req, res) => {
  const id = Number(req.params.id);
  const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
  try {
    const record = await prisma.waitlistEntry.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ success: false, error: 'Waitlist entry not found' });
    res.json({ success: true, data: sanitizeWaitlist(record, canViewContacts) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/waitlist/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildWaitlistEntryData({ ...(req.body ?? {}), id });
  if (!data.clientName) {
    return res.status(400).json({ success: false, error: 'Waitlist client name is required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'waitlistEntry',
    id,
    prisma.waitlistEntry.update({ where: { id }, data }).then(withStoredId),
    'WaitlistEntry',
    'update waitlist entry',
  );
});

router.delete('/waitlist/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }
  const existing = await prisma.waitlistEntry.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Запись не найдена' });
  }

  const existingPayload = existing.payload && typeof existing.payload === 'object' ? existing.payload : {};
  const nextPayload = {
    ...existingPayload,
    deletedAt: new Date().toISOString(),
    previousStatus: existing.status || 'active',
  };

  await auditUpdate(
    prisma,
    req,
    res,
    'waitlistEntry',
    id,
    prisma.waitlistEntry.update({
      where: { id },
      data: {
        status: 'deleted',
        payload: nextPayload,
      },
    }).then(withStoredId),
    'WaitlistEntry',
    'soft delete waitlist entry',
  );
});

router.post('/waitlist/:id/restore', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }
  const existing = await prisma.waitlistEntry.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Запись не найдена' });
  }

  const existingPayload = existing.payload && typeof existing.payload === 'object' ? { ...existing.payload } : {};
  const targetStatus = existingPayload.previousStatus || 'active';
  delete existingPayload.deletedAt;
  delete existingPayload.previousStatus;

  await auditUpdate(
    prisma,
    req,
    res,
    'waitlistEntry',
    id,
    prisma.waitlistEntry.update({
      where: { id },
      data: {
        status: targetStatus,
        payload: existingPayload,
      },
    }).then(withStoredId),
    'WaitlistEntry',
    'restore waitlist entry',
  );
});

router.get('/waitlist', async (req, res) => {
  const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
  try {
    const records = await prisma.waitlistEntry.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ success: true, data: records.map((r) => sanitizeWaitlist(r, canViewContacts)) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== Supplies CRUD ====================
router.post('/supplies', (req, res) => {
  const data = buildSupplyData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Supply name is required' });
  }

  auditCreate(prisma, req, res, prisma.supply.create({ data }).then(withStoredId), 'Supply', 'create supply');
});

router.get('/supplies/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.supply.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/supplies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildSupplyData({ ...(req.body ?? {}), id });
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Supply name is required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'supply',
    id,
    prisma.supply.update({ where: { id }, data }).then(withStoredId),
    'Supply',
    'update supply',
  );
});

router.delete('/supplies/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    prisma,
    req,
    res,
    'supply',
    id,
    prisma.supply.delete({ where: { id } }).then(withStoredId),
    'Supply',
    'delete supply',
  );
});

router.get('/supplies', (req, res) => {
  respond(
    res,
    prisma.supply
      .findMany({ orderBy: { name: 'asc' } })
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Message Templates CRUD ====================
router.post('/message-templates', (req, res) => {
  const data = buildMessageTemplateData(req.body ?? {});
  if (!data.name || !data.body) {
    return res.status(400).json({ success: false, error: 'Template name and body are required' });
  }

  auditCreate(
    prisma,
    req,
    res,
    prisma.messageTemplate.create({ data }).then(withStoredId),
    'MessageTemplate',
    'create message template',
  );
});

router.get('/message-templates/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.messageTemplate.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/message-templates/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = buildMessageTemplateData({ ...(req.body ?? {}), id });
  if (!data.name || !data.body) {
    return res.status(400).json({ success: false, error: 'Template name and body are required' });
  }

  await auditUpdate(
    prisma,
    req,
    res,
    'messageTemplate',
    id,
    prisma.messageTemplate.update({ where: { id }, data }).then(withStoredId),
    'MessageTemplate',
    'update message template',
  );
});

router.delete('/message-templates/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    prisma,
    req,
    res,
    'messageTemplate',
    id,
    prisma.messageTemplate.delete({ where: { id } }).then(withStoredId),
    'MessageTemplate',
    'delete message template',
  );
});

router.get('/message-templates', (req, res) => {
  respond(
    res,
    prisma.messageTemplate
      .findMany({ orderBy: { name: 'asc' } })
      .then((records) => records.map(withStoredId)),
  );
});

// ==================== Communication Log CRUD ====================
router.post('/communication-log', requirePermission(PERMISSIONS.CLIENTS_MANAGE), (req, res) => {
  const data = buildCommunicationLogData(req.body ?? {});
  if (!data.clientName && !data.body) {
    return res.status(400).json({ success: false, error: 'Communication log entry is empty' });
  }

  auditCreate(
    prisma,
    req,
    res,
    prisma.communicationLog.create({ data }).then(withStoredId),
    'CommunicationLog',
    'create communication log',
  );
});

router.get('/communication-log/:id', requirePermission(PERMISSIONS.CLIENTS_VIEW), async (req, res) => {
  const id = Number(req.params.id);
  const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
  try {
    const record = await prisma.communicationLog.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ success: false, error: 'Communication log not found' });
    res.json({ success: true, data: sanitizeCommLog(record, canViewContacts) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/communication-log/:id', requirePermission(PERMISSIONS.CLIENTS_MANAGE), async (req, res) => {
  const id = Number(req.params.id);
  const data = buildCommunicationLogData({ ...(req.body ?? {}), id });
  await auditUpdate(
    prisma,
    req,
    res,
    'communicationLog',
    id,
    prisma.communicationLog.update({ where: { id }, data }).then(withStoredId),
    'CommunicationLog',
    'update communication log',
  );
});

router.delete('/communication-log/:id', requireOwner, async (req, res) => {
  const id = Number(req.params.id);
  await auditDelete(
    prisma,
    req,
    res,
    'communicationLog',
    id,
    prisma.communicationLog.delete({ where: { id } }).then(withStoredId),
    'CommunicationLog',
    'delete communication log',
  );
});

router.get('/communication-log', requirePermission(PERMISSIONS.CLIENTS_VIEW), async (req, res) => {
  const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
  try {
    const records = await prisma.communicationLog.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: records.map((r) => sanitizeCommLog(r, canViewContacts)) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
