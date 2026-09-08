-- =============================================================
-- NomadWallet · Sprint 3 · Migración ADITIVA de `transactions`
-- =============================================================
-- Agrega `to_user_id` (destinatario de las transferencias) a la tabla
-- `transactions` sin tocar ninguna columna existente (aditiva, idempotente,
-- retrocompatible). Aplicable contra Railway (ya creada en Sprints 1-2).
--
-- Regla del contrato maestro:
--   - `user_id`       = quien inicia la operación (remitente en transferencias)
--   - `to_user_id`    = destinatario de la transferencia (NULL para el resto)
--   - `currency`/`amount` = moneda y monto ORIGEN (sin cambios)
-- Las filas viejas quedan con to_user_id = NULL (historial intacto).
--
-- FK a users(id) con ON DELETE SET NULL: si se borra el destinatario, la
-- transferencia sigue en el historial del remitente sin referenciarlo.
--
-- Idempotente: repetir este script no rompe nada (IF NOT EXISTS).
-- Uso:  npm run db:migrate   (o aplicar este archivo con psql)
-- =============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_to_user_id ON transactions (to_user_id);