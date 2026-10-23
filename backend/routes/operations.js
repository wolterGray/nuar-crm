const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { isOwnerAuth, requirePermission, hasPermission, PERMISSIONS } = require('../middleware/auth');
const { maskEmail, maskPhoneNumber } = require('../constants/permissions');
const { getHttpErrorResponse } = require('../utils/httpErrors');
const {reconcileSiteBookingWaitlistClients} = require('../services/siteBookingClientService');
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
const denyAccess = (res) => res.status(403).json({success: false, error: 'Доступ запрещён'});
const getAuthUserId = (auth) => String(auth?.sub || auth?.id || '');
const getNoteAccess = (note) => {
  const payload = notePayload(note);
  return {
    ownerUserId: String(payload.ownerUserId || ''),
    visibility: ['private', 'work', 'owner'].includes(payload.visibility)
      ? payload.visibility
      : 'owner',
  };
};
const canAccessNote = (auth, note) => {
  if (!note || !isNote(note)) return false;
  const access = getNoteAccess(note);
  if (access.ownerUserId && access.ownerUserId === getAuthUserId(auth)) return true;
  if (access.visibility === 'private') return false;
  if (access.visibility === 'owner') return isOwnerAuth(auth);
  return (
    access.visibility === 'work' &&
    Boolean(
      isOwnerAuth(auth) ||
      auth?.role === 'admin' ||
      auth?.role === 'manager' ||
      auth?.role === 'staff'
    )
  );
};
const stampNoteAccess = (data, auth) => {
  const payload = notePayload(data);
  const requestedVisibility = String(payload.visibility || '').toLowerCase();
  const defaultVisibility = isOwnerAuth(auth)
    ? 'owner'
    : auth?.role === 'admin'
      ? 'work'
      : 'private';
  const allowedVisibility = isOwnerAuth(auth)
    ? new Set(['private', 'work', 'owner'])
    : new Set(['private', 'work']);
  return {
    ...data,
    payload: {
      ...payload,
      ownerUserId: getAuthUserId(auth),
      visibility: allowedVisibility.has(requestedVisibility)
        ? requestedVisibility
        : defaultVisibility,
    },
  };
};
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

const getWaitlistEmployeeId = (entry) => {
  const payload = objectPayload(entry?.payload);
  return Number(payload.employeeId || payload.masterId) || null;
};

const canAccessWaitlistEntry = (auth, entry) => {
  if (hasPermission(auth, PERMISSIONS.CALENDAR_VIEW_ALL)) return true;
  const employeeId = Number(auth?.employeeId) || null;
  return Boolean(employeeId && getWaitlistEmployeeId(entry) === employeeId);
};

const scopeWaitlistPayload = (auth, payload) => {
  if (hasPermission(auth, PERMISSIONS.CALENDAR_VIEW_ALL)) return payload;
  const employeeId = Number(auth?.employeeId) || null;
  if (!employeeId) return null;
  return {...payload, employeeId, masterId: employeeId};
};

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

const serializeSupply = (record, auth) => {
  const base = withStoredId(record);
  if (hasPermission(auth, PERMISSIONS.TASKS_MANAGE)) return base;
  return {...base, cost: null, orderUrl: null};
};

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

const enrichWaitlistBookingPrices = async (entries = []) => {
  const siteBookingIds = new Set(
    entries
      .map((entry) => objectPayload(entry?.payload).siteBookingRequestId)
      .filter(Boolean)
      .map(String),
  );
  if (!siteBookingIds.size) return entries;

  try {
    const requests = await prisma.$queryRaw`
      select id, payload
      from site_booking_requests
      where status = 'pending'
      order by created_at desc
      limit 200
    `;
    const priceByRequestId = new Map(
      (requests ?? []).flatMap((request) => {
        const payload = objectPayload(request?.payload);
        const price = Number(payload.bookedPrice ?? payload.finalPrice);
        return Number.isFinite(price) && price > 0
          ? [[String(request.id), price]]
          : [];
      }),
    );

    return entries.map((entry) => {
      const payload = objectPayload(entry?.payload);
      const requestId = String(payload.siteBookingRequestId ?? '');
      const bookedPrice = Number(payload.bookedPrice ?? priceByRequestId.get(requestId));
      if (!Number.isFinite(bookedPrice) || bookedPrice <= 0) return entry;
      return {...entry, payload: {...payload, bookedPrice}};
    });
  } catch (error) {
    console.warn('Failed to enrich waitlist booking prices:', error?.message || error);
    return entries;
  }
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
    const isOwner = isOwnerAuth(req.auth);
    const canViewContacts = hasPermission(req.auth, PERMISSIONS.CLIENTS_VIEW_CONTACTS);
    const canViewLogs = hasPermission(req.auth, PERMISSIONS.LOGS_VIEW);
    const canManageTasks = hasPermission(req.auth, PERMISSIONS.TASKS_MANAGE);
    const canViewAllCalendar = hasPermission(req.auth, PERMISSIONS.CALENDAR_VIEW_ALL);
    const userEmpId = req.auth?.employeeId ? Number(req.auth.employeeId) : null;

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
      (isOwner || canManageTasks)
        ? prisma.messageTemplate.findMany({ orderBy: { name: 'asc' } })
        : Promise.resolve([]),
      (isOwner || canViewLogs)
        ? prisma.communicationLog.findMany({ orderBy: { createdAt: 'desc' } })
        : Promise.resolve([]),
    ]);

    const linkedWaitlistEntries = await reconcileSiteBookingWaitlistClients(prisma, waitlistEntries);

    // Filter waitlist entries for staff without calendar.view_all
    const filteredWaitlist = linkedWaitlistEntries.filter((w) => {
      if (canViewAllCalendar) return true;
      if (!userEmpId) return false;
      const entryEmpId = getWaitlistEmployeeId(w);
      return entryEmpId && Number(entryEmpId) === userEmpId;
    });
    const pricedWaitlist = await enrichWaitlistBookingPrices(filteredWaitlist);

    res.json({
      success: true,
      data: {
        communicationLog: communicationLog.map((l) => sanitizeCommLog(l, canViewContacts)),
        messageTemplates: messageTemplates.map(withStoredId),
        supplies: supplies.map((supply) => serializeSupply(supply, req.auth)),
        tasks: tasks
          .filter((task) => {
            if (isNote(task)) {
              return !notePayload(task).deletedAt && canAccessNote(req.auth, task);
            }
            return canManageTasks;
          })
          .map(withStoredId),
        waitlistEntries: pricedWaitlist.map((w) => sanitizeWaitlist(w, canViewContacts)),
      },
    });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Operations state error:', err);
    res.status(response.status).json({ success: false, error: response.message });
  }
});

// ==================== Task CRUD ====================
router.post('/tasks', (req, res) => {
  let data = buildTaskData(req.body ?? {});
  if (isNote(data)) {
    data = stampNoteAccess(data, req.auth);
  } else if (!hasPermission(req.auth, PERMISSIONS.TASKS_MANAGE)) {
    return denyAccess(res);
  }
  if (!data.title) {
    return res.status(400).json({ success: false, error: 'Task title is required' });
  }

  auditCreate(prisma, req, res, createTaskWithMainGuard(data).then(withStoredId), 'Task', 'create task');
});

router.post('/tasks/transfer-checklist-item', requirePermission(PERMISSIONS.TASKS_MANAGE), async (req, res) => {
  try {
    const { sourceTaskId, sourceDate, checklistItemId, targetDate } = req.body ?? {};
    if (!sourceTaskId || !checklistItemId || !targetDate) {
      return res.status(400).json({ success: false, error: 'sourceTaskId, checklistItemId, and targetDate are required' });
    }
    const cleanTargetDate = String(targetDate).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanTargetDate)) {
      return res.status(400).json({ success: false, error: 'targetDate must be in YYYY-MM-DD format' });
    }
    const cleanSourceDate = sourceDate ? String(sourceDate).trim() : null;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findUnique({ where: { id: Number(sourceTaskId) } });
      if (!existing) {
        const error = new Error('Source task not found');
        error.status = 404;
        throw error;
      }
      if (isNote(existing) && !isOwnerAuth(req.auth)) {
        const error = new Error('Owner role required');
        error.status = 403;
        throw error;
      }

      const rawPayload = objectPayload(existing.payload);
      const nestedPayload = objectPayload(rawPayload.payload);
      const payload = Object.keys(nestedPayload).length ? { ...rawPayload, ...nestedPayload } : rawPayload;

      const isRepeating = payload.repeat?.enabled === true || payload.taskKind === 'daily';
      let foundItem;
      let nextChecklist;
      let updatedPayload;
      let updatedStatus = null;
      let updatedCompleted = undefined;

      if (isRepeating && cleanSourceDate) {
        // Occurrence-specific checklist override
        const occurrence = objectPayload(payload.occurrences?.[cleanSourceDate]);
        const checklist = Array.isArray(occurrence.checklist)
          ? occurrence.checklist
          : Array.isArray(payload.checklist)
            ? payload.checklist
            : [];

        foundItem = checklist.find((i) => String(i?.id) === String(checklistItemId));
        if (!foundItem) {
          const error = new Error('Checklist item not found');
          error.status = 400;
          throw error;
        }

        nextChecklist = checklist.filter((i) => String(i?.id) !== String(checklistItemId));
        const transferRecord = {
          id: foundItem.id,
          text: foundItem.text,
          targetDate: cleanTargetDate,
          sourceDate: cleanSourceDate,
          transferredAt: new Date().toISOString(),
        };

        const allDone = nextChecklist.length > 0 && nextChecklist.every((i) => i.done);
        const nextOccurrence = {
          ...occurrence,
          checklist: nextChecklist,
          transferredItems: [
            ...(Array.isArray(occurrence.transferredItems) ? occurrence.transferredItems : []),
            transferRecord,
          ],
          ...(allDone && occurrence.status !== 'completed' ? { status: 'completed', completedAt: new Date().toISOString() } : {}),
        };

        updatedPayload = {
          ...payload,
          occurrences: {
            ...(payload.occurrences || {}),
            [cleanSourceDate]: nextOccurrence,
          },
        };
      } else {
        // Regular task checklist
        const checklist = Array.isArray(payload.checklist) ? payload.checklist : [];
        foundItem = checklist.find((i) => String(i?.id) === String(checklistItemId));
        if (!foundItem) {
          const error = new Error('Checklist item not found');
          error.status = 400;
          throw error;
        }

        nextChecklist = checklist.filter((i) => String(i?.id) !== String(checklistItemId));
        const transferRecord = {
          id: foundItem.id,
          text: foundItem.text,
          targetDate: cleanTargetDate,
          sourceDate: cleanSourceDate || (existing.dueDate ? existing.dueDate.toISOString().slice(0, 10) : ''),
          transferredAt: new Date().toISOString(),
        };

        const allDone = nextChecklist.length > 0 && nextChecklist.every((i) => i.done);
        updatedPayload = {
          ...payload,
          checklist: nextChecklist,
          transferredItems: [
            ...(Array.isArray(payload.transferredItems) ? payload.transferredItems : []),
            transferRecord,
          ],
        };
        if (allDone && existing.status !== 'completed') {
          updatedStatus = 'completed';
          updatedCompleted = true;
        }
      }

      // 1. Update source task
      const updateData = { payload: updatedPayload };
      if (updatedStatus) updateData.status = updatedStatus;
      if (updatedCompleted !== undefined) updateData.completed = updatedCompleted;

      const updatedSourceTask = await tx.task.update({
        where: { id: existing.id },
        data: updateData,
      });

      // 2. Create target standalone task
      const newTaskData = {
        type: 'task',
        title: String(foundItem.text || '').trim(),
        description: `Перенесено из задачи «${existing.title}»${cleanSourceDate ? ` (${cleanSourceDate})` : ''}`,
        note: `Перенесено из задачи «${existing.title}»`,
        dueDate: toDate(cleanTargetDate),
        priority: existing.priority || 'medium',
        status: 'active',
        completed: false,
        sortOrder: 0,
        payload: {
          areaId: payload.areaId || 'general',
          areaLabel: payload.areaLabel || '',
          assigneeId: payload.assigneeId || '',
          assigneeName: payload.assigneeName || '',
          originTaskId: existing.id,
          originTaskTitle: existing.title,
          originChecklistItemId: foundItem.id,
          originDate: cleanSourceDate || '',
          transferredFromChecklist: true,
          dueDate: cleanTargetDate,
        },
      };

      const createdNewTask = await tx.task.create({ data: newTaskData });

      return {
        sourceTask: withStoredId(updatedSourceTask),
        newTask: withStoredId(createdNewTask),
      };
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    const response = getHttpErrorResponse(err);
    console.error('Transfer checklist item error:', err);
    res.status(response.status || 500).json({ success: false, error: response.message });
  }
});

router.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.task.findUnique({ where: { id } }).then((task) => {
    if (isNote(task) && !canAccessNote(req.auth, task)) {
      const error = new Error('Доступ запрещён');
      error.status = 403;
      throw error;
    }
    if (!isNote(task) && !hasPermission(req.auth, PERMISSIONS.TASKS_MANAGE)) {
      const error = new Error('Доступ запрещён');
      error.status = 403;
      throw error;
    }
    return withStoredId(task);
  }));
});

router.put('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.task.findUnique({where: {id}});
  if (isNote(existing) && !canAccessNote(req.auth, existing)) return denyAccess(res);
  if (!isNote(existing) && !hasPermission(req.auth, PERMISSIONS.TASKS_MANAGE)) return denyAccess(res);
  let data = buildTaskData({ ...(req.body ?? {}), id });
  if (isNote(existing)) {
    data = {...data, payload: {...notePayload(existing), ...notePayload(data)}};
  }
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

router.delete('/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.task.findUnique({where: {id}});
  if (isNote(existing)) {
    if (!canAccessNote(req.auth, existing)) return denyAccess(res);
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
  if (!isOwnerAuth(req.auth)) return denyAccess(res);
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
        .filter((task) => isNote(task)
          ? canAccessNote(req.auth, task) && !notePayload(task).deletedAt
          : hasPermission(req.auth, PERMISSIONS.TASKS_MANAGE))
        .map(withStoredId)),
  );
});

// ==================== Personal and work notes ====================
router.patch('/notes/:id', async (req, res) => {
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
      if (!canAccessNote(req.auth, existing)) {
        const error = new Error('Доступ запрещён');
        error.status = 403;
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
      const requestedVisibility = String(incomingPayload.visibility || currentPayload.visibility || '').toLowerCase();
      const nextVisibility = isOwnerAuth(req.auth)
        ? (['private', 'work', 'owner'].includes(requestedVisibility) ? requestedVisibility : 'owner')
        : (['private', 'work'].includes(requestedVisibility) ? requestedVisibility : getNoteAccess(existing).visibility);
      const nextPayload = {
        ...currentPayload,
        ...incomingPayload,
        ownerUserId: currentPayload.ownerUserId || getAuthUserId(req.auth),
        visibility: nextVisibility,
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

router.get('/notes-trash', async (req, res) => {
  try {
    const notes = await prisma.task.findMany({where: {type: 'note'}, orderBy: {updatedAt: 'desc'}});
    res.json({
      success: true,
      data: notes
        .filter((note) => canAccessNote(req.auth, note) && Boolean(notePayload(note).deletedAt))
        .map(withStoredId),
    });
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.post('/notes/:id/restore', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.task.findUnique({where: {id}});
    if (!existing || !isNote(existing)) return res.status(404).json({success: false, error: 'Note not found'});
    if (!canAccessNote(req.auth, existing)) return denyAccess(res);
    const payload = {...notePayload(existing)};
    delete payload.deletedAt;
    const saved = await prisma.task.update({where: {id}, data: {payload, status: 'active'}});
    res.json({success: true, data: withStoredId(saved)});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.delete('/notes/:id/permanent', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const existing = await prisma.task.findUnique({where: {id}});
    if (!existing || !isNote(existing) || !notePayload(existing).deletedAt) {
      return res.status(404).json({success: false, error: 'Deleted note not found'});
    }
    if (!canAccessNote(req.auth, existing)) return denyAccess(res);
    await prisma.task.delete({where: {id}});
    res.json({success: true, data: {id}});
  } catch (error) {
    const response = getHttpErrorResponse(error);
    res.status(response.status).json({success: false, error: response.message});
  }
});

router.get('/notes/:id/revisions', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await ensureNoteTables(prisma);
    const note = await prisma.task.findUnique({where: {id}});
    if (!note || !isNote(note)) return res.status(404).json({success: false, error: 'Note not found'});
    if (!canAccessNote(req.auth, note)) return denyAccess(res);
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

router.post('/notes/:id/revisions/:revisionId/restore', async (req, res) => {
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
      if (!canAccessNote(req.auth, existing)) {
        const error = new Error('Доступ запрещён');
        error.status = 403;
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

router.get('/notes/:id/attachments', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await ensureNoteTables(prisma);
    const note = await prisma.task.findUnique({where: {id}});
    if (!note || !isNote(note)) return res.status(404).json({success: false, error: 'Note not found'});
    if (!canAccessNote(req.auth, note)) return denyAccess(res);
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

router.post('/notes/:id/attachments', async (req, res) => {
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
    if (!canAccessNote(req.auth, note)) return denyAccess(res);
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

router.get('/notes/attachments/:attachmentId/content', async (req, res) => {
  try {
    await ensureNoteTables(prisma);
    const rows = await prisma.$queryRaw`
      select id, note_id, file_name, mime_type, data
      from note_attachments
      where id = ${String(req.params.attachmentId)}
      limit 1
    `;
    const attachment = rows?.[0];
    if (!attachment) return res.status(404).json({success: false, error: 'Attachment not found'});
    const note = await prisma.task.findUnique({where: {id: Number(attachment.note_id)}});
    if (!canAccessNote(req.auth, note)) return denyAccess(res);
    res.set('Content-Type', attachment.mime_type);
    res.set('Content-Disposition', `inline; filename="${cleanFileName(attachment.file_name)}"`);
    res.set('Cache-Control', 'private, max-age=300');
    return res.send(attachment.data);
  } catch (error) {
    const response = getHttpErrorResponse(error);
    return res.status(response.status).json({success: false, error: response.message});
  }
});

router.delete('/notes/attachments/:attachmentId', async (req, res) => {
  try {
    await ensureNoteTables(prisma);
    const attachments = await prisma.$queryRaw`
      select note_id from note_attachments
      where id = ${String(req.params.attachmentId)}
      limit 1
    `;
    const attachment = attachments?.[0];
    if (!attachment) return res.status(404).json({success: false, error: 'Attachment not found'});
    const note = await prisma.task.findUnique({where: {id: Number(attachment.note_id)}});
    if (!canAccessNote(req.auth, note)) return denyAccess(res);
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
  const scopedPayload = scopeWaitlistPayload(req.auth, req.body ?? {});
  if (!scopedPayload) return denyAccess(res);
  const data = buildWaitlistEntryData(scopedPayload);
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
    if (!canAccessWaitlistEntry(req.auth, record)) return denyAccess(res);
    res.json({ success: true, data: sanitizeWaitlist(record, canViewContacts) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/waitlist/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.waitlistEntry.findUnique({where: {id}});
  if (!existing) return res.status(404).json({success: false, error: 'Waitlist entry not found'});
  if (!canAccessWaitlistEntry(req.auth, existing)) return denyAccess(res);
  const scopedPayload = scopeWaitlistPayload(req.auth, {...(req.body ?? {}), id});
  if (!scopedPayload) return denyAccess(res);
  const data = buildWaitlistEntryData(scopedPayload);
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
  if (!canAccessWaitlistEntry(req.auth, existing)) return denyAccess(res);

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
  if (!canAccessWaitlistEntry(req.auth, existing)) return denyAccess(res);

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
    const accessibleRecords = records.filter((record) => canAccessWaitlistEntry(req.auth, record));
    const pricedRecords = await enrichWaitlistBookingPrices(accessibleRecords);
    res.json({
      success: true,
      data: pricedRecords.map((record) => sanitizeWaitlist(record, canViewContacts)),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== Supplies CRUD ====================
router.post('/supplies', requirePermission(PERMISSIONS.TASKS_MANAGE), (req, res) => {
  const data = buildSupplyData(req.body ?? {});
  if (!data.name) {
    return res.status(400).json({ success: false, error: 'Supply name is required' });
  }

  auditCreate(prisma, req, res, prisma.supply.create({ data }).then(withStoredId), 'Supply', 'create supply');
});

router.get('/supplies/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.supply.findUnique({ where: { id } }).then((record) => serializeSupply(record, req.auth)));
});

router.put('/supplies/:id', async (req, res) => {
  const id = Number(req.params.id);
  const canManage = hasPermission(req.auth, PERMISSIONS.TASKS_MANAGE);
  const existing = await prisma.supply.findUnique({where: {id}});
  if (!existing) return res.status(404).json({success: false, error: 'Supply not found'});
  const data = canManage
    ? buildSupplyData({ ...(req.body ?? {}), id })
    : {stock: Number(req.body?.stock ?? existing.stock) || 0};
  if (canManage && !data.name) {
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

router.delete('/supplies/:id', requirePermission(PERMISSIONS.TASKS_MANAGE), async (req, res) => {
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
      .then((records) => records.map((record) => serializeSupply(record, req.auth))),
  );
});

// ==================== Message Templates CRUD ====================
router.post('/message-templates', requirePermission(PERMISSIONS.TASKS_MANAGE), (req, res) => {
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

router.get('/message-templates/:id', requirePermission(PERMISSIONS.TASKS_MANAGE), (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.messageTemplate.findUnique({ where: { id } }).then(withStoredId));
});

router.put('/message-templates/:id', requirePermission(PERMISSIONS.TASKS_MANAGE), async (req, res) => {
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

router.delete('/message-templates/:id', requirePermission(PERMISSIONS.TASKS_MANAGE), async (req, res) => {
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

router.get('/message-templates', requirePermission(PERMISSIONS.TASKS_MANAGE), (req, res) => {
  respond(
    res,
    prisma.messageTemplate
      .findMany({ orderBy: { name: 'asc' } })
      .then((records) => records.map(withStoredId)),
  );
});

router.canAccessNote = canAccessNote;
router.getNoteAccess = getNoteAccess;

module.exports = router;
