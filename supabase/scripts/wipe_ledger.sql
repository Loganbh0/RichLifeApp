-- Wipe ledger data; keep categories and envelopes (balances zeroed).
-- Run in Supabase SQL Editor, or via: node backend/scripts/wipe.mjs

DELETE FROM transactions;
UPDATE envelopes SET balance = 0;
