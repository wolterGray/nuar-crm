const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const {PrismaClient} = require('@prisma/client');
const {checkReadiness} = require('./services/readinessService');
const {
  getWorkerStatus,
  startNotificationWorker,
  stopNotificationWorker,
} = require('./services/notificationWorker');

const app = express();
const serverPrisma = new PrismaClient();

const requiredAuthEnv = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'JWT_SECRET'];
const missingAuthEnv = requiredAuthEnv.filter((name) => !process.env[name]);
if (missingAuthEnv.length > 0) {
  console.error(
    `[auth] Missing required environment variables: ${missingAuthEnv.join(', ')}. ` +
      'Set them in backend/.env before using /api/auth/login or protected CRM APIs.'
  );
}

const defaultAllowedOrigins = [
  'https://crm.nuarr.pl',
  'https://nuarr.pl',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5179',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5179',
  'http://192.168.18.20:5173',
];
const envAllowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...envAllowedOrigins]);
const isDev = process.env.NODE_ENV !== 'production';
const isLocalDevOrigin = (origin) =>
  isDev &&
  /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):\d+$/.test(
    origin
  );
const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(helmet());
app.use(express.json({ limit: '15mb' }));

// CRM data is mutable and must never be served from a stale browser cache.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Health endpoint
app.get('/health', (_req, res) => {
  res.set('Cache-Control', 'no-store').status(200).json({status: 'ok'});
});
app.get('/ready', async (_req, res) => {
  const readiness = await checkReadiness({getWorkerStatus, prisma: serverPrisma});
  res.set('Cache-Control', 'no-store').status(readiness.ready ? 200 : 503).json(readiness);
});

// Routes
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

const { publicApiLimiter } = require('./middleware/rateLimiter');

// Public API Rate Limiting
app.use('/api/public', publicApiLimiter);

const publicSiteRouter = require('./routes/publicSite');
app.use('/api/public', publicSiteRouter);

const { publicSiteBookingRouter, siteBookingRouter } = require('./routes/siteBooking');
app.use('/api/public', publicSiteBookingRouter);

const { publicLoyaltyRouter, loyaltyRouter } = require('./routes/loyalty');
app.use('/api/public', publicLoyaltyRouter);

const { verifyJwt, requireActiveUser } = require('./middleware/auth');

const functionsRouter = require('./routes/functions');
app.use('/functions', verifyJwt, requireActiveUser, functionsRouter);

// Global authenticated & active-user check for all private CRM routes
app.use('/api', verifyJwt, requireActiveUser);

const siteCmsRouter = require('./routes/siteCms');
app.use('/api', siteCmsRouter);

app.use('/api', siteBookingRouter);

const usersRouter = require('./routes/users');
app.use('/api', usersRouter);

const notificationEventsRouter = require('./routes/notificationEvents');
app.use('/api', notificationEventsRouter);
const pushNotificationsRouter = require('./routes/pushNotifications');
app.use('/api', pushNotificationsRouter);
app.use('/api', loyaltyRouter);

const clientsRouter = require('./routes/clients');
const employeesRouter = require('./routes/employees');
const servicesRouter = require('./routes/services');
const visitsRouter = require('./routes/visits');
const financeRouter = require('./routes/finance');
const employeePayoutsRouter = require('./routes/employeePayouts');
const operationsRouter = require('./routes/operations');
const systemStateRouter = require('./routes/systemState');
const auditLogsRouter = require('./routes/auditLogs');

app.use('/api', clientsRouter);
app.use('/api', employeesRouter);
app.use('/api', servicesRouter);
app.use('/api', visitsRouter);
app.use('/api', financeRouter);
app.use('/api', employeePayoutsRouter);
app.use('/api', operationsRouter);
app.use('/api', systemStateRouter);
app.use('/api', auditLogsRouter);

// Error handling middleware – must be after routes
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend listening on http://localhost:${PORT}`);
  startNotificationWorker(serverPrisma);
});

let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received; draining connections...`);
  stopNotificationWorker();

  const forceExit = setTimeout(() => {
    console.error('[shutdown] Graceful shutdown timed out');
    process.exit(1);
  }, 10000);
  if (typeof forceExit.unref === 'function') forceExit.unref();

  server.close(async (error) => {
    clearTimeout(forceExit);
    try {
      await serverPrisma.$disconnect();
    } finally {
      process.exit(error ? 1 : 0);
    }
  });
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

module.exports = {app, server};
