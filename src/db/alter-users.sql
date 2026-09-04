-- =============================================================
-- NomadWallet · Sprint 2 · Migración aditiva: identidad en users
-- Agrega las columnas de identidad que el registro necesita
-- (first_name, last_name, dni) sin tocar ninguna columna existente.
-- Idempotente (ADD COLUMN IF NOT EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS).
-- Aplicable contra Railway con:  npm run db:alter
-- =============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS last_name  VARCHAR(120),
  ADD COLUMN IF NOT EXISTS dni        VARCHAR(20);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_dni_unique
ON users (dni);