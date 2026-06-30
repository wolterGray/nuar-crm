const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5179',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5179',
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
app.options('/api/clients', cors(corsOptions));
app.use(helmet());
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Routes
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

const functionsRouter = require('./routes/functions');
app.use('/functions', functionsRouter);

const crudRouter = require('./routes/crud');
app.use('/api', crudRouter);

// Error handling middleware – must be after routes
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Backend listening on http://localhost:${PORT}`);
});
