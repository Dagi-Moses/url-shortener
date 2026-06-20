/**
 * Integration tests for the URL Shortener API.
 * Uses supertest against the Express app with a real (test) DB.
 *
 * Run with: npm test
 * Requires DATABASE_URL env var pointing to a test PostgreSQL instance.
 */

const request = require('supertest');

// Mock the DB module so tests don't need a live Postgres
jest.mock('../src/db', () => {
  const links = new Map();
  const clicks = [];

  const mockPool = {
    query: jest.fn(async (sql, params) => {
    
      if (sql.trim().startsWith('INSERT INTO links')) {
        const [slug, target_url, expires_at] = params;
        if (links.has(slug)) {
          const err = new Error('duplicate');
          err.code = '23505';
          throw err;
        }
        const row = { slug, target_url, expires_at: expires_at || null, click_count: 0, created_at: new Date() };
        links.set(slug, row);
        return { rows: [row], rowCount: 1 };
      }
  
      if (sql.includes('FROM links WHERE slug')) {
        const slug = params[0];
        const link = links.get(slug);
        return { rows: link ? [link] : [], rowCount: link ? 1 : 0 };
      }
   
      if (sql.includes('UPDATE links SET click_count')) {
        const slug = params[0];
        if (links.has(slug)) links.get(slug).click_count += 1;
        return { rowCount: 1 };
      }
   
      if (sql.includes('INSERT INTO click_events')) {
        clicks.push({ slug: params[0], user_agent: params[1], clicked_at: new Date() });
        return { rowCount: 1 };
      }
     
      if (sql.includes('FROM links') && sql.includes('ORDER BY')) {
        const [limit, offset] = params;
        const all = Array.from(links.values()).slice(offset, offset + limit);
        return { rows: all, rowCount: all.length };
      }
     
      if (sql.includes('COUNT(*)')) {
        return { rows: [{ count: String(links.size) }] };
      }
   
      if (sql.includes('DELETE FROM links')) {
        const slug = params[0];
        const existed = links.delete(slug);
        return { rows: existed ? [{ slug }] : [], rowCount: existed ? 1 : 0 };
      }
     
      if (sql.includes('FROM click_events')) {
        const slugClicks = clicks.filter((c) => c.slug === params[0]);
        return { rows: slugClicks, rowCount: slugClicks.length };
      }
   
      if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
      return { rows: [], rowCount: 0 };
    }),
    connect: jest.fn(async () => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
  };

  return { pool: mockPool, initDB: jest.fn() };
});

const app = require('../src/index');

describe('POST /api/links', () => {
  it('creates a link and returns 201 with slug', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ target_url: 'https://example.com' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBeDefined();
    expect(res.body.short_url).toMatch(/https?:\/\/.+\/.+/);
    expect(res.body.click_count).toBe(0);
  });

  it('accepts a custom slug', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ target_url: 'https://example.com/custom', slug: 'mylink' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('mylink');
  });

  it('returns 400 for missing target_url', async () => {
    const res = await request(app).post('/api/links').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for an invalid URL', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ target_url: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a bad slug format', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ target_url: 'https://example.com', slug: 'bad slug!' });
    expect(res.status).toBe(400);
  });

  it('returns 409 for a duplicate custom slug', async () => {
    await request(app)
      .post('/api/links')
      .send({ target_url: 'https://example.com', slug: 'dup' });
    const res = await request(app)
      .post('/api/links')
      .send({ target_url: 'https://example.com', slug: 'dup' });
    expect(res.status).toBe(409);
  });

  it('returns 400 for a past expiry date', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ target_url: 'https://example.com', expires_at: '2020-01-01T00:00:00Z' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/links', () => {
  it('returns a list of links', async () => {
    const res = await request(app).get('/api/links');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.links)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });
});

describe('GET /:slug (redirect)', () => {
  it('redirects to the target URL', async () => {
    const create = await request(app)
      .post('/api/links')
      .send({ target_url: 'https://redirect-target.com', slug: 'redir1' });
    const slug = create.body.slug;

    const res = await request(app).get(`/${slug}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://redirect-target.com');
  });

  it('returns 404 for unknown slug', async () => {
    const res = await request(app).get('/definitely-not-real');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/links/:slug', () => {
  it('deletes an existing link', async () => {
    await request(app)
      .post('/api/links')
      .send({ target_url: 'https://delete-me.com', slug: 'todelete' });

    const res = await request(app).delete('/api/links/todelete');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/);
  });

  it('returns 404 for a non-existent slug', async () => {
    const res = await request(app).delete('/api/links/ghost');
    expect(res.status).toBe(404);
  });
});

describe('GET /health', () => {
  it('returns service status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBeDefined();
  });
});
