# Deployment notes — Rich Life

## Every release

1. **Migrations** — Apply any new `supabase/migrations/000N_*.sql` in Supabase (SQL Editor, in order). See [SUPABASE.md](SUPABASE.md).
   - Before deploying notes / envelope detail: run [`0002_transaction_notes.sql`](supabase/migrations/0002_transaction_notes.sql) if not already applied.
   - Before deploying envelope delete: run [`0003_envelope_soft_delete.sql`](supabase/migrations/0003_envelope_soft_delete.sql).
2. **Backend** — Push to `main` (Render auto-deploys if connected). Confirm:
   ```bash
   curl https://<your-api>.onrender.com/health
   ```
   Expect `{ "status": "ok" }`.
3. **Frontend** — Push under `frontend/**` triggers GitHub Actions Pages deploy, or run:
   ```bash
   cd frontend
   npm run deploy
   ```
4. Hard-refresh the live site.

## Render env

| Key | Notes |
|-----|--------|
| `DATABASE_URL` | Supabase transaction pooler (`:6543`) |
| `API_KEY` | Long random secret |
| `CORS_ORIGIN` | Pages origin, e.g. `https://<user>.github.io` |

## GitHub Actions / Pages

- Workflow: [`.github/workflows/deploy-frontend.yml`](.github/workflows/deploy-frontend.yml)
- Secrets: `VITE_API_BASE_URL`, `VITE_API_KEY`
- Optional variable: `VITE_BASE` (default `/MoneyBudgetApp/`)
- Repo **Settings → Pages → Source**: GitHub Actions

## Free Render cold starts

First request after idle can take 30–60+ seconds. Hit `/health` once before using the app.

## Reset ledger data (optional)

Deletes all transactions and sets every envelope balance to `0` (keeps categories/envelopes):

```bash
cd backend
npm run wipe
```

Or paste [`supabase/scripts/wipe_ledger.sql`](supabase/scripts/wipe_ledger.sql) into the Supabase SQL Editor.

