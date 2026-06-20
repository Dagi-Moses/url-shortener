const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for POST /api/links.
 * Allows up to 20 link creations per 15 minutes per IP.
 * Uses in-memory store (no Redis dependency).
 */
const createLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true, 
  legacyHeaders: false,
  message: {
    error: 'Too many links created from this IP. Please try again in 15 minutes.',
    retryAfter: '15 minutes',
  },
  keyGenerator: (req) => req.ip,
});

module.exports = { createLinkLimiter };
