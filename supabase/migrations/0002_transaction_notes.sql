-- Optional notes on transactions (payee / source context)
ALTER TABLE transactions
  ADD COLUMN notes text;
