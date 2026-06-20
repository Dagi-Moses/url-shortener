const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
//  ssl: false,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS links (
        id          SERIAL PRIMARY KEY,
        slug        VARCHAR(20) UNIQUE NOT NULL,
        target_url  TEXT NOT NULL,
        expires_at  TIMESTAMPTZ,
        click_count INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS click_events (
        id         SERIAL PRIMARY KEY,
        slug       VARCHAR(20) NOT NULL REFERENCES links(slug) ON DELETE CASCADE,
        clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_agent TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
      CREATE INDEX IF NOT EXISTS idx_click_events_slug ON click_events(slug);
    `);
    console.log('Database schema ready');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
