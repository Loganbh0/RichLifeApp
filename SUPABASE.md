# Rich Life — Supabase Backend Setup

Step-by-step guide to create the Postgres database, apply migrations, and connect the Express API.

---

## 1. Create a Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. **New project** → pick an org, name it (e.g. `rich-life`), set a strong database password, choose a region close to you.
3. Wait until the project is ready (green status).

Save the database password somewhere safe — you need it for the connection string.

---

## 2. Apply migrations

Migrations live in [`supabase/migrations/`](supabase/migrations/). Apply them **in order**.

### Option A — SQL Editor (simplest)

1. Open the project → **SQL Editor** → **New query**.
2. Paste the full contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. Click **Run**. Confirm success (no errors).
4. If you add later files (`0002_…sql`, etc.), run each one the same way, in numeric order.

### Option B — Supabase CLI

```bash
# From the repo root (after supabase login + link)
npx supabase db push
```

Or paste each migration file manually if you prefer not to use the CLI.

### What `0001_init.sql` creates

| Object | Purpose |
|--------|---------|
| `categories` | Groups for the envelope list (Monthly, Savings, …) |
| `envelopes` | Budget pots + one system **Unallocated** row |
| `transactions` | Append-only ledger (`income` / `expense` / `transfer`) |
| RLS | Enabled on all tables with **no** public policies |
| Seed | Sample categories, Unallocated, starter Monthly envelopes |

---

## 3. Copy the pooler connection string

The API must use the **Transaction pooler** URI (port **6543**), not the direct connection (5432).

1. Supabase → **Project Settings** → **Database**.
2. Under **Connection string**, choose **URI**.
3. Prefer **Transaction** mode / pooler (host looks like `aws-0-<region>.pooler.supabase.com`, port `6543`).
4. Replace `[YOUR-PASSWORD]` with the database password.
5. Set this value as `DATABASE_URL` in the backend (local `.env` and Render).

Example shape:

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

---

## 4. Confirm RLS is locked down

1. **Database** → **Tables** → open `categories`, `envelopes`, `transactions`.
2. Each table should show **RLS enabled**.
3. **Authentication** → **Policies** (or table policy tab): there should be **no** policies allowing `anon` or `authenticated` read/write.

Only the backend (via `DATABASE_URL`) should access data. Do **not** put the `service_role` key or DB password in the frontend.

---

## 5. Wire environment variables

### Local — `backend/.env`

```env
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
API_KEY=                          # optional locally; leave empty to skip auth
CORS_ORIGIN=http://localhost:5173
PORT=3000
```

Copy from [`backend/.env.example`](backend/.env.example).

### Local — `frontend/.env`

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_API_KEY=                     # same as backend API_KEY if set
VITE_BASE=/
```

### Production (Render)

In the Render web service (see `render.yaml`):

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Pooler URI from step 3 |
| `API_KEY` | Long random secret (e.g. `openssl rand -hex 32`) |
| `CORS_ORIGIN` | Your GitHub Pages origin, e.g. `https://<user>.github.io` |

### Production (frontend / GitHub Actions)

Secrets / vars:

| Name | Value |
|------|--------|
| `VITE_API_BASE_URL` | `https://<your-api>.onrender.com/api/v1` |
| `VITE_API_KEY` | Same as Render `API_KEY` |
| `VITE_BASE` | `/MoneyBudgetApp/` (or your repo name) |

---

## 6. Verify locally

```bash
# Terminal 1 — API
cd backend
cp .env.example .env   # fill DATABASE_URL
npm install
npm run dev            # http://localhost:3000

# Health (no API key)
curl http://localhost:3000/health
# → {"status":"ok"}

# Terminal 2 — optional smoke
cd backend
node scripts/smoke.mjs
```

Smoke script checks: list envelopes → income to Unallocated → transfer into an envelope → expense.

Then:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

Open the app, confirm the total card, Unallocated, and category sections load.

---

## 7. Deploy order

1. Apply any new SQL migrations in Supabase.
2. Deploy / restart the Render API; confirm `GET /health`.
3. Deploy the frontend (GitHub Actions or `npm run deploy`).
4. Hard-refresh the live site.

See [STACK.md](STACK.md) and [DEPLOYMENT.md](DEPLOYMENT.md) for the full release checklist.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `SSL` / certificate errors from `pg` | Pooler needs TLS; the backend sets `ssl: { rejectUnauthorized: false }` for Supabase. |
| Timeouts or “Tenant or user not found” | Wrong password, project ref, or using direct host instead of pooler. |
| Empty data / permission denied via anon key | Expected — do not use the Supabase JS client against tables. Use the Express API only. |
| Render API slow on first request | Free tier cold start (30–60s). Hit `/health` once, then retry. |
| `Unallocated cannot go negative` | By design when transferring/spending from Unallocated without enough balance. Add income first. |
| Migration already applied / duplicate Unallocated | Do not re-run `0001` on a populated DB. Use a new numbered migration for changes. |

---

## Quick checklist

- [ ] Supabase project created
- [ ] `0001_init.sql` applied
- [ ] RLS on; no public policies
- [ ] `DATABASE_URL` = transaction pooler `:6543`
- [ ] Backend `.env` / Render env set
- [ ] `GET /health` returns ok
- [ ] Smoke or UI: income → fill envelope → expense works
