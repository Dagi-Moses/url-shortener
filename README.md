# URL Shortener API

A production ready URL shortener built with Node.js, Express, and PostgreSQL. Containerised with Docker, documented, and tested.

## Features

- Create short links with optional custom slugs and expiry dates
- 302 redirects with click tracking (count + user-agent per click)
- Paginated link listing
- Link deletion
- Health endpoint reporting service + DB status
- Rate limiting on link creation (20 requests / 15 min per IP)
- Input validation with descriptive 400 errors
- Click analytics endpoint

---

## Setup

### Option A — Docker Compose (recommended)

```bash
git clone https://github.com/Dagi-Moses/url-shortener
cd url-shortener
docker compose up --build
```

The service starts on **http://localhost:8080**. Postgres data is persisted in a named volume (`pgdata`).

### Option B — Local Node.js

**Prerequisites:** Node.js 18+, a running PostgreSQL instance.

```bash
cp .env.example .env
# edit .env with your DATABASE_URL

npm install
npm start
```

---

## API Reference

### `POST /api/links` — Create a short link

**Body (JSON):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `target_url` | string | ✅ | The destination URL (`http`/`https`) |
| `slug` | string | ❌ | Custom slug (3–20 chars, `[a-zA-Z0-9_-]`) |
| `expires_at` | string (ISO 8601) | ❌ | Expiry date (must be in the future) |

```bash
# Basic
curl -X POST http://localhost:8080/api/links \
  -H "Content-Type: application/json" \
  -d '{"target_url": "https://example.com"}'

# Custom slug + expiry
curl -X POST http://localhost:8080/api/links \
  -H "Content-Type: application/json" \
  -d '{"target_url": "https://example.com", "slug": "mylink", "expires_at": "2025-12-31T23:59:59Z"}'
```

**Response `201`:**
```json
{
  "slug": "mylink",
  "short_url": "http://localhost:8080/mylink",
  "target_url": "https://example.com",
  "expires_at": "2025-12-31T23:59:59.000Z",
  "click_count": 0,
  "created_at": "2024-01-15T10:30:00.000Z"
}
```

---

### `GET /:slug` — Redirect

Returns `302` to target URL, or `404` if not found / expired.

```bash
curl -L http://localhost:8080/mylink
```

---

### `GET /api/links` — List all links

Supports `?page=1&limit=50` query params (max limit: 100).

```bash
curl http://localhost:8080/api/links
curl "http://localhost:8080/api/links?page=2&limit=10"
```

**Response `200`:**
```json
{
  "links": [
    {
      "slug": "mylink",
      "short_url": "http://localhost:8080/mylink",
      "target_url": "https://example.com",
      "expires_at": null,
      "click_count": 5,
      "created_at": "2024-01-15T10:30:00.000Z",
      "is_expired": false
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1, "pages": 1 }
}
```

---

### `DELETE /api/links/:slug` — Delete a link

```bash
curl -X DELETE http://localhost:8080/api/links/mylink
```

**Response `200`:**
```json
{ "message": "Link 'mylink' deleted successfully." }
```

---

### `GET /api/links/:slug/analytics` — Click analytics

```bash
curl http://localhost:8080/api/links/mylink/analytics
```

**Response `200`:**
```json
{
  "link": { "slug": "mylink", "click_count": 5, ... },
  "recent_clicks": [
    { "clicked_at": "2024-01-15T11:00:00.000Z", "user_agent": "Mozilla/5.0 ..." }
  ]
}
```

---

### `GET /health` — Service health

```bash
curl http://localhost:8080/health
```

**Response `200`:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "service": "url-shortener",
  "database": { "status": "ok", "latency_ms": 3 },
  "uptime_seconds": 142
}
```

Returns `503` if the database is unreachable.

---

## Running Tests

```bash
npm test
```

Tests use a mocked DB so no Postgres instance is required.

---

## Known Limitations

- **Rate limiting is in-memory.** If you run multiple app replicas, each will have its own counter. For multi-replica deployments, replace the in-memory store with Redis using `rate-limit-redis`.

- **Analytics retention.** `click_events` rows are never pruned. For high-traffic links, add a periodic cleanup job or partition the table by date.

- **No authentication.** Any caller can create or delete links. Adding an API key middleware would be a straightforward extension.

- **SQLite alternative.** The app targets PostgreSQL. To use SQLite, swap the `pg` driver for `better-sqlite3` and adjust the pool configuration — the schema SQL is otherwise compatible.
