const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const start = Date.now();
  let dbStatus = 'ok';
  let dbLatencyMs = null;

  try {
    await pool.query('SELECT 1');
    dbLatencyMs = Date.now() - start;
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';

  return res.status(status === 'ok' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    service: 'url-shortener',
    database: {
      status: dbStatus,
      latency_ms: dbLatencyMs,
    },
    uptime_seconds: Math.floor(process.uptime()),
  });
});

module.exports = router;
