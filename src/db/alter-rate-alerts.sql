-- =============================================================
-- NomadWallet · Sprint 2 · Migración aditiva: rate_alerts
-- Crea la tabla de alertas de tasa sin tocar ninguna tabla existente
-- (aditiva, idempotente, retrocompatible). Aplicable contra Railway.
-- Uso:  npm run db:migrate   (o aplicar este archivo con psql)
-- =============================================================

CREATE TABLE IF NOT EXISTS rate_alerts (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_currency VARCHAR(3) NOT NULL CHECK (from_currency IN ('USD','EUR','COP')),
  to_currency   VARCHAR(3) NOT NULL CHECK (to_currency IN ('USD','EUR','COP')),
  threshold     NUMERIC(18,6) NOT NULL CHECK (threshold > 0),
  condition     VARCHAR(3) NOT NULL DEFAULT 'gte' CHECK (condition IN ('gte','lte')),
  status        VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active','triggered')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_rate_alerts_diff_currencies CHECK (from_currency <> to_currency)
);

CREATE INDEX IF NOT EXISTS idx_rate_alerts_user_id ON rate_alerts (user_id);