-- =============================================================
-- NomadWallet · Sprint 2 · Etapa 3 · Migración aditiva: goals
-- Crea la tabla de metas de viaje sin tocar ninguna tabla existente
-- (aditiva, idempotente, retrocompatible). Aplicable contra Railway.
-- Uso:  npm run db:migrate   (o aplicar este archivo con psql)
-- =============================================================

CREATE TABLE IF NOT EXISTS goals (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           VARCHAR(120) NOT NULL,
  currency       VARCHAR(3)  NOT NULL CHECK (currency IN ('USD','EUR','COP')),
  target_amount  NUMERIC(18,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals (user_id);