// backend/routes/crud.js
// CRUD routes for CRM data using Prisma.

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ----- Helper for unified response -----
const respond = (res, promise) => {
  promise
    .then((data) => res.json({ success: true, data }))
    .catch((err) => {
      console.error('CRUD error:', err);
      res.status(400).json({ success: false, error: err.message });
    });
};

// ==================== Client ====================
router.get('/clients', (req, res) => {
  respond(
    res,
    prisma.client.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    })
  );
});

router.post('/clients', (req, res) => {
  const { name, email, phone } = req.body;
  respond(res, prisma.client.create({ data: { name, email, phone } }));
});

router.get('/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.client.findUnique({ where: { id } }));
});

router.put('/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, email, phone } = req.body;
  respond(res, prisma.client.update({ where: { id }, data: { name, email, phone } }));
});

router.delete('/clients/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.client.delete({ where: { id } }));
});


// ==================== Service ====================
router.post('/services', (req, res) => {
  const { name, price, durationMin } = req.body;
  respond(res, prisma.service.create({ data: { name, price, durationMin } }));
});

router.get('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.service.findUnique({ where: { id } }));
});

router.put('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, price, durationMin } = req.body;
  respond(res, prisma.service.update({ where: { id }, data: { name, price, durationMin } }));
});

router.delete('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.service.delete({ where: { id } }));
});

router.get('/services', (req, res) => {
  respond(res, prisma.service.findMany());
});

// ==================== Employee ====================
router.post('/employees', (req, res) => {
  const { name, role, email } = req.body;
  respond(res, prisma.employee.create({ data: { name, role, email } }));
});

router.get('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.employee.findUnique({ where: { id } }));
});

router.put('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, role, email } = req.body;
  respond(res, prisma.employee.update({ where: { id }, data: { name, role, email } }));
});

router.delete('/employees/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.employee.delete({ where: { id } }));
});

router.get('/employees', (req, res) => {
  respond(res, prisma.employee.findMany());
});

// ==================== Visit ====================
router.post('/visits', (req, res) => {
  const { clientId, serviceId, employeeId, scheduledAt, notes } = req.body;
  respond(
    res,
    prisma.visit.create({
      data: {
        clientId,
        serviceId,
        employeeId,
        scheduledAt: new Date(scheduledAt),
        notes,
      },
    })
  );
});

router.get('/visits/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.visit.findUnique({ where: { id } }));
});

router.put('/visits/:id', (req, res) => {
  const id = Number(req.params.id);
  const { clientId, serviceId, employeeId, scheduledAt, notes } = req.body;
  respond(
    res,
    prisma.visit.update({
      where: { id },
      data: {
        clientId,
        serviceId,
        employeeId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        notes,
      },
    })
  );
});

router.delete('/visits/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.visit.delete({ where: { id } }));
});

router.get('/visits', (req, res) => {
  respond(res, prisma.visit.findMany());
});

// ==================== Task ====================
router.post('/tasks', (req, res) => {
  const { title, description, dueDate, completed } = req.body;
  respond(
    res,
    prisma.task.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        completed: !!completed,
      },
    })
  );
});

router.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.task.findUnique({ where: { id } }));
});

router.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const { title, description, dueDate, completed } = req.body;
  respond(
    res,
    prisma.task.update({
      where: { id },
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        completed: completed !== undefined ? !!completed : undefined,
      },
    })
  );
});

router.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  respond(res, prisma.task.delete({ where: { id } }));
});

router.get('/tasks', (req, res) => {
  respond(res, prisma.task.findMany());
});

module.exports = router;
