-- Soft-delete envelopes (keep transaction history; hide from lists)
ALTER TABLE envelopes
  ADD COLUMN deleted_at timestamptz;

CREATE INDEX envelopes_deleted_at_idx ON envelopes (deleted_at);
