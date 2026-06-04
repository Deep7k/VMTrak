'use strict';

require('dotenv').config();

const express      = require('express');
const cookieParser = require('cookie-parser');
const cors         = require('cors');
const helmet       = require('helmet');
const { initDb }   = require('./db/database');
const logger       = require('./utils/logger');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes        = require('./routes/auth');
const vmRoutes          = require('./routes/vms');
const credRoutes        = require('./routes/credentials');
const userRoutes        = require('./routes/users');
const auditRoutes       = require('./routes/audit');
const dashboardRoutes   = require('./routes/dashboard');
const hypervisorRoutes  = require('./routes/hypervisors');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Core middleware ───────────────────────────────────────────────────────────
app.set('trust proxy', 1); // Respect X-Forwarded-For from NPM

app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// ── Health (unauthenticated) ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const { version } = require('../package.json');
  res.json({ status: 'ok', version, uptime: Math.floor(process.uptime()) });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/vms',         vmRoutes);
app.use('/api/vms',         credRoutes);         // /api/vms/:id/credentials/*
app.use('/api/users',       userRoutes);
app.use('/api/audit',       auditRoutes);
app.use('/api/dashboard',   dashboardRoutes);
app.use('/api/hypervisors', hypervisorRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status  = err.status || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    logger.error('Unhandled error', { error: message, stack: err.stack });
  }

  res.status(status).json({
    error:   message,
    ...(err.details && { details: err.details }),
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  await initDb();

  // Load scheduler after DB is ready
  require('./services/scheduler');

  app.listen(PORT, () => {
    logger.info(`VMTrak backend listening on port ${PORT}`);
  });
}

start().catch(err => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
