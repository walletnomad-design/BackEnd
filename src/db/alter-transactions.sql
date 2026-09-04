-- =============================================================
-- NomadWallet · Sprint 2 · Migración ADITIVA de `transactions`
-- =============================================================
-- Aplicar contra la base de PRODUCCIÓN (Railway), creada en Sprint 1
-- con: id, user_id, wallet_id, type, currency, amount, created_at.
--
-- Regla del contrato maestro: NUNCA renombrar ni recrear
--   currency = moneda origen
--   amount   = monto origen
--   type     = tipo de operación (buy | sell | exchange)
-- Railway ya tiene datos reales en esas columnas.
--
-- Aquí SOLO se AGREGAN las columnas que faltan para Sprint 2:
--   to_currency (moneda destino) · to_amount (monto destino)
--   rate (tasa utilizada) · status (estado)
-- Las columnas nuevas son NULLABLE (salvo status con default)
-- para no falsear el historial de Sprint 1 (las filas viejas no
-- registraban esos datos → quedan en NULL).
--
-- Idempotente: repetir este script no rompe nada (IF NOT EXISTS).
-- =============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS to_currency VARCHAR(3)
    CHECK (to_currency IN ('USD', 'EUR', 'COP')),
  ADD COLUMN IF NOT EXISTS to_amount   NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS rate        NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS status      VARCHAR(20) NOT NULL DEFAULT 'completed';