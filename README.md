# Rich Life

Shared envelope budgeting for a household. Allocate income into Unallocated, fill envelopes, spend, and move money between pots.

**Stack:** React + Vite → Express API → Supabase Postgres  
See [STACK.md](STACK.md) for the pattern and [SUPABASE.md](SUPABASE.md) for database setup.

## Features (v1)

- Total of all envelopes at the top
- **Unallocated** pot for paychecks (cannot go negative when assigning/spending)
- Envelopes with title, target, category, and progress bar
- List grouped by category
- Add Income / Expense / Move transactions
- Create and edit envelopes (and categories)

## Repo layout

```
frontend/                 # Vite + React SPA
backend/                  # Express API
supabase/migrations/      # SQL schema
SUPABASE.md               # Connect Supabase
STACK.md                  # Architecture template
```

## Local development

### 1. Database

Follow [SUPABASE.md](SUPABASE.md): create a project, run `supabase/migrations/0001_init.sql`, copy the **transaction pooler** URI into `backend/.env`.

### 2. API

```bash
cd backend
cp .env.example .env   # set DATABASE_URL
npm install
npm run dev            # http://localhost:3000
```

Health: `GET http://localhost:3000/health` → `{ "status": "ok" }`

Optional: `npm run smoke`

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:3000/api/v1
npm install
npm run dev            # http://localhost:5173
```

For local Vite, keep `VITE_BASE=/` in `.env`.

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md).

1. Migrations in Supabase  
2. Render API (`render.yaml`) with `DATABASE_URL`, `API_KEY`, `CORS_ORIGIN`  
3. GitHub Pages frontend via Actions (secrets: `VITE_API_BASE_URL`, `VITE_API_KEY`)
