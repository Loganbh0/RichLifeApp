# Personal Web App Stack Template

A lightweight pattern for single-user (or trusted-user) web apps:

**React + Vite frontend** → **Express API** → **Postgres (Supabase)**

Suitable for budget, fitness, productivity, schoolwork, habit trackers, etc.

```
Browser (public GitHub Pages)
        │  HTTPS + x-api-key
        ▼
Express API (Render)
        │  DATABASE_URL (pooler)
        ▼
Postgres (Supabase)
```

---

## Design principles

1. **Static frontend, thin API** — UI is a static SPA; all persistence goes through your API.
2. **Database is the source of truth** — schema + seed live as numbered SQL migrations.
3. **Single-user security model** — shared API key in the frontend build is acceptable for personal apps; do **not** put Supabase `service_role` (or DB credentials) in the frontend.
4. **RLS locked down** — enable Row Level Security on tables with **no public policies**, so the anon Data API cannot read/write; only the backend connection string can.
5. **Versioned schema** — `0001_*.sql`, `0002_*.sql`, … applied in order.
6. **Domain-agnostic API shape** — REST under `/api/v1`, health at `/health`, JSON in/out.

---

## Repo layout

```
YourApp/
  frontend/                 # Vite + React SPA
    src/
      api.js                # fetch wrapper + endpoint helpers
      App.jsx               # react-router routes
      pages/                # one page per screen
      components/           # shared UI
    vite.config.js          # base path for GitHub Pages
    package.json
  backend/                  # Express API
    src/
      index.js              # routes, CORS, listen
      middleware.js         # API key, asyncHandler, errorHandler
      db.js                 # pg Pool + query + withTransaction
      queries.js            # SQL / business logic
    scripts/
      smoke.mjs             # optional end-to-end API checks
    package.json
  supabase/
    migrations/             # numbered .sql files
  .github/workflows/
    deploy-frontend.yml     # build + publish Pages on push
  render.yaml               # Render web service blueprint
  README.md
  DEPLOYMENT.md             # per-release deploy notes
```

---

## Frontend

### Stack

- **React 18** + **Vite 5**
- **react-router-dom** for tabs/screens
- Optional charts (e.g. Recharts) only if needed
- Mobile-first CSS (CSS variables, dark/light as you prefer)

### API client pattern

Centralize all network calls in one module:

```js
const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
const API_KEY = import.meta.env.VITE_API_KEY || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // listThings: () => request('/things'),
  // createThing: (body) =>
  //   request('/things', { method: 'POST', body: JSON.stringify(body) }),
};
```

### Vite / GitHub Pages

Set `base` to `/<repo-name>/`:

```js
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/YourRepoName/',
});
```

### Frontend env

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Full API root, including `/api/v1` |
| `VITE_API_KEY` | Same value as backend `API_KEY` |
| `VITE_BASE` | Pages path, e.g. `/YourRepoName/` |

---

## Backend

### Stack

- **Node ≥ 18**, ESM (`"type": "module"`)
- **Express** + **cors** + **dotenv**
- **pg** (`Pool`) for Postgres

### Core pieces

**Health (no auth):**

```http
GET /health  →  { "status": "ok" }
```

**API mount:**

```js
app.use('/api/v1', apiRouter); // apiRouter uses requireApiKey
```

**API key middleware:**

- Header: `x-api-key`
- If `API_KEY` unset (local), allow through; always set in production

**DB helper:**

- `Pool` with Supabase SSL (`rejectUnauthorized: false` for pooler)
- `query(text, params)`
- `withTransaction(fn)` for multi-step writes

**Errors:**

- Wrap handlers with `asyncHandler`
- Map `err.status` → HTTP status; return `{ error: message }`

### Typical route style

```
GET    /api/v1/resources
GET    /api/v1/resources/:id
POST   /api/v1/resources
PUT    /api/v1/resources/:id
DELETE /api/v1/resources/:id   # if needed
```

Keep SQL in a `queries.js` (or per-domain modules), not inline in every route.

### Backend env

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase **pooler** URI (port `6543`) |
| `API_KEY` | Long random shared secret |
| `CORS_ORIGIN` | Frontend origin(s), comma-separated |
| `PORT` | Local only; Render injects this |

### `render.yaml` sketch

```yaml
services:
  - type: web
    name: your-app-api
    runtime: node
    plan: free          # or paid
    rootDir: backend
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: API_KEY
        sync: false
      - key: CORS_ORIGIN
        sync: false
```

Push to `main` → Render auto-deploys (if connected).

---

## Database (Supabase Postgres)

### Workflow

1. Create a Supabase project.
2. Add migrations under `supabase/migrations/` as `0001_init.sql`, `0002_…`, …
3. Apply via SQL Editor (paste in order) or Supabase CLI (`supabase db push`).
4. Copy **Database → Connection string → URI (pooler)** into `DATABASE_URL`.

### Schema habits

- Prefer clear tables for your domain (`accounts`, `transactions`, `tasks`, `entries`, …).
- Use `timestamptz`, `numeric` for money, `date` for calendar days.
- Enable **RLS** on every table; leave **no** policies for `anon`/`authenticated` if the API is the only client.
- Evolve with new migration files; document “run `000N` before deploy” in `DEPLOYMENT.md`.

### Seed (optional)

Keep seed data as SQL (or generate SQL from JSON). Don’t hard-code primary domain data in React.

---

## Deploy order (every release)

1. **Migrations** in Supabase (if schema changed).
2. **Push backend** → wait for Render → confirm `GET https://<api>.onrender.com/health` → `{ "status": "ok" }`.
3. **Frontend** — GitHub Actions on `frontend/**` push, or `cd frontend && npm run deploy`.
4. Hard-refresh the live site.

### GitHub Actions (frontend)

- Trigger on `main` pushes under `frontend/**` (and `workflow_dispatch`).
- Secrets: `VITE_API_BASE_URL`, `VITE_API_KEY`
- Variable: `VITE_BASE` (optional)
- Pages source: **GitHub Actions**
- Artifact path: `frontend/dist`

### Free Render note

Cold starts can take 30–60+ seconds after idle; health check may be slow on first hit.

---

## Local development

```bash
# Terminal 1 — API
cd backend
cp .env.example .env   # DATABASE_URL, optional API_KEY
npm install
npm run dev            # http://localhost:3000

# Terminal 2 — UI
cd frontend
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:3000/api/v1
npm install
npm run dev            # http://localhost:5173
```

Optional: `node scripts/smoke.mjs` against a running API.

---

## Security notes (personal apps)

| Do | Don’t |
|----|--------|
| Put only `API_KEY` in the public frontend | Put DB passwords or `service_role` in the frontend |
| Lock RLS with no public policies | Expose Supabase anon key for write access without thinking |
| Use a long random `API_KEY` | Rely on obscurity of the API URL alone |
| Restrict `CORS_ORIGIN` to your Pages origin | Use `*` in production if you can avoid it |

This model is **not** multi-tenant auth. For shared/public apps, add real auth (e.g. Supabase Auth + JWT) instead of a shared API key.

---

## Checklist for a new app

- [ ] Monorepo: `frontend/`, `backend/`, `supabase/migrations/`
- [ ] Express `/health` + `/api/v1` + `x-api-key`
- [ ] `pg` Pool + transactions
- [ ] Numbered SQL migrations + RLS locked
- [ ] React `api.js` wrapper
- [ ] Vite `base` for Pages
- [ ] `render.yaml` + env vars
- [ ] GitHub Actions Pages deploy + secrets
- [ ] `README.md` + short `DEPLOYMENT.md` per release
