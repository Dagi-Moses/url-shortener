require('dotenv').config();

const express = require('express');
const { initDB, pool } = require('./db');
const linksRouter = require('./routes/links');
const healthRouter = require('./routes/health');

const app = express();
 const PORT = process.env.PORT || 8080;


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set('trust proxy', 1);

// Routes
app.use('/health', healthRouter);
app.use('/api/links', linksRouter);

// GET /:slug — redirect to target URL
app.get('/:slug', async (req, res) => {
  const { slug } = req.params;

  if (['favicon.ico', 'robots.txt'].includes(slug)) {
    return res.status(404).end();
  }

  try {
    const result = await pool.query(
      `SELECT target_url, expires_at FROM links WHERE slug = $1`,
      [slug]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Link not found.' });
    }

    const link = result.rows[0];

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(404).json({ error: 'This link has expired.' });
    }

    // Increment click count and log analytics (fire-and-forget, non-blocking)
    pool.query(
      'UPDATE links SET click_count = click_count + 1 WHERE slug = $1',
      [slug]
    ).catch((err) => console.error('Failed to increment click count:', err));

    pool.query(
      'INSERT INTO click_events (slug, user_agent) VALUES ($1, $2)',
      [slug, req.get('user-agent') || null]
    ).catch((err) => console.error('Failed to log click event:', err));

    return res.redirect(302, link.target_url);
  } catch (err) {
    console.error('Redirect error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});


app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});


async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`URL Shortener running on port ${PORT}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
}

module.exports = app; // exported for tests
