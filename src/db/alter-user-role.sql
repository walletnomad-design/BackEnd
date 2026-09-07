-- =============================================================
-- NomadWallet · Sprint 2 · Migración aditiva: role en users
-- Agrega la columna `role` para distinguir usuarios comunes de
-- administradores ('user' | 'admin'), por defecto 'user' (el registro
-- no puede auto-asignarse admin). No toca ninguna columna existente.
-- Idempotente (ADD COLUMN IF NOT EXISTS con CHECK inline).
-- Aplicable contra Railway con:  npm run db:alter
-- =============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(5) NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));