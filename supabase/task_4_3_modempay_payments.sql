ALTER TABLE payments ADD COLUMN IF NOT EXISTS intent_secret text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id text;
