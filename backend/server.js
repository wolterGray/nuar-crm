require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// CORS configuration – use env variable or allow all in dev
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(helmet());
app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Routes
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
