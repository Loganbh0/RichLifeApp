-- Rich Life initial schema
-- categories, envelopes (incl. Unallocated), transactions + RLS + seed

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- envelopes
-- ---------------------------------------------------------------------------
CREATE TABLE envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories (id) ON DELETE SET NULL,
  name text NOT NULL,
  balance numeric(12, 2) NOT NULL DEFAULT 0,
  target numeric(12, 2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  is_unallocated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT envelopes_unallocated_no_category CHECK (
    (is_unallocated = true AND category_id IS NULL)
    OR (is_unallocated = false)
  )
);

CREATE UNIQUE INDEX envelopes_one_unallocated
  ON envelopes (is_unallocated)
  WHERE is_unallocated = true;

CREATE INDEX envelopes_category_id_idx ON envelopes (category_id);
CREATE INDEX envelopes_sort_order_idx ON envelopes (sort_order);

-- ---------------------------------------------------------------------------
-- transactions (append-only ledger)
-- ---------------------------------------------------------------------------
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  envelope_id uuid REFERENCES envelopes (id) ON DELETE RESTRICT,
  from_envelope_id uuid REFERENCES envelopes (id) ON DELETE RESTRICT,
  to_envelope_id uuid REFERENCES envelopes (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transactions_shape CHECK (
    (
      type IN ('income', 'expense')
      AND envelope_id IS NOT NULL
      AND from_envelope_id IS NULL
      AND to_envelope_id IS NULL
    )
    OR (
      type = 'transfer'
      AND envelope_id IS NULL
      AND from_envelope_id IS NOT NULL
      AND to_envelope_id IS NOT NULL
      AND from_envelope_id <> to_envelope_id
    )
  )
);

CREATE INDEX transactions_created_at_idx ON transactions (created_at DESC);
CREATE INDEX transactions_envelope_id_idx ON transactions (envelope_id);

-- ---------------------------------------------------------------------------
-- RLS locked down (API uses DATABASE_URL only; no anon policies)
-- ---------------------------------------------------------------------------
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Seed
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, name, sort_order) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'Monthly', 1),
  ('a1000000-0000-4000-8000-000000000002', 'Giving', 2),
  ('a1000000-0000-4000-8000-000000000003', 'Savings', 3);

INSERT INTO envelopes (id, category_id, name, balance, target, sort_order, is_unallocated) VALUES
  ('b1000000-0000-4000-8000-000000000001', NULL, 'Unallocated', 0, 0, 0, true),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Groceries', 0, 400.00, 1, false),
  ('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Gas', 0, 150.00, 2, false),
  ('b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'Eating Out', 0, 100.00, 3, false),
  ('b1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'Rent', 0, 1500.00, 4, false),
  ('b1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000001', 'Utilities', 0, 200.00, 5, false),
  ('b1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000002', 'Giving', 0, 100.00, 1, false),
  ('b1000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000003', 'Emergency Fund', 0, 1000.00, 1, false);
