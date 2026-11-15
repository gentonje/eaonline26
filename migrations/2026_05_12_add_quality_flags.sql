-- ─────────────────────────────────────────────────────────────────────────────
-- Quality flagging columns for products
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run (uses IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS quality_flag       text,        -- 'blurry' | 'harmful' | null
  ADD COLUMN IF NOT EXISTS quality_reason     text,        -- short human-readable reason
  ADD COLUMN IF NOT EXISTS quality_checked_at timestamptz, -- last time scanner ran on this product
  ADD COLUMN IF NOT EXISTS quality_image_path text;        -- the storage_path that was scanned (so we know to recheck if image changes)

-- Optional: index to make the daily scan fast
CREATE INDEX IF NOT EXISTS products_quality_checked_at_idx
  ON products (quality_checked_at NULLS FIRST);

CREATE INDEX IF NOT EXISTS products_quality_flag_idx
  ON products (quality_flag) WHERE quality_flag IS NOT NULL;
