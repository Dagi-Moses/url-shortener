const express = require('express');
const { nanoid } = require('nanoid');
const { pool } = require('../db');
const { validateUrl, validateSlug, validateExpiry } = require('../utils/validate');
const { createLinkLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /api/links
router.post('/', createLinkLimiter, async (req, res) => {
  const { target_url, slug: customSlug, expires_at } = req.body;


  const urlError = validateUrl(target_url);
  if (urlError) return res.status(400).json({ error: urlError });

  const slugError = validateSlug(customSlug);
  if (slugError) return res.status(400).json({ error: slugError });

  const { date: expiryDate, error: expiryError } = validateExpiry(expires_at);
  if (expiryError) return res.status(400).json({ error: expiryError });

  const slug = customSlug || nanoid(7);

  try {
    const result = await pool.query(
      `INSERT INTO links (slug, target_url, expires_at)
       VALUES ($1, $2, $3)
       RETURNING slug, target_url, expires_at, click_count, created_at`,
      [slug, target_url, expiryDate]
    );

    const link = result.rows[0];
    return res.status(201).json({
      slug: link.slug,
      short_url: `${req.protocol}://${req.get('host')}/${link.slug}`,
      target_url: link.target_url,
      expires_at: link.expires_at,
      click_count: link.click_count,
      created_at: link.created_at,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Slug '${slug}' is already taken. Choose a different one.` });
    }
    throw err;
  }
});

// GET /api/links 
router.get('/', async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const result = await pool.query(
    `SELECT slug, target_url, expires_at, click_count, created_at
     FROM links
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limitNum, offset]
  );

  const countResult = await pool.query('SELECT COUNT(*) FROM links');
  const total = parseInt(countResult.rows[0].count, 10);

  return res.json({
    links: result.rows.map((link) => ({
      ...link,
      short_url: `${req.protocol}://${req.get('host')}/${link.slug}`,
      is_expired: link.expires_at ? new Date(link.expires_at) < new Date() : false,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

// DELETE /api/links/:slug 
router.delete('/:slug', async (req, res) => {
  const { slug } = req.params;
  const result = await pool.query(
    'DELETE FROM links WHERE slug = $1 RETURNING slug',
    [slug]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: `Link with slug '${slug}' not found.` });
  }

  return res.json({ message: `Link '${slug}' deleted successfully.` });
});

// GET /api/links/:slug/analytics 
router.get('/:slug/analytics', async (req, res) => {
  const { slug } = req.params;

  const linkResult = await pool.query(
    'SELECT slug, target_url, click_count, created_at, expires_at FROM links WHERE slug = $1',
    [slug]
  );

  if (linkResult.rowCount === 0) {
    return res.status(404).json({ error: `Link with slug '${slug}' not found.` });
  }

  const eventsResult = await pool.query(
    `SELECT clicked_at, user_agent FROM click_events
     WHERE slug = $1 ORDER BY clicked_at DESC LIMIT 100`,
    [slug]
  );

  return res.json({
    link: linkResult.rows[0],
    recent_clicks: eventsResult.rows,
  });
});

module.exports = router;
