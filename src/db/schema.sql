-- =============================================================
-- NomadWallet · Sprint 1 · Esquema de base de datos (P2)
-- Tablas congeladas por el contrato. No renombrar sin acuerdo.
--   users -> wallets -> balances
--   users -> transactions
-- Colaboradores: SERIAL (entero) para que `id` llegue como number
-- al JSON (pg devuelve int8 como string; enteros evitan ese tema).
-- Montos: NUMERIC(18,2) para precisión financiera; los repositorios
-- castearán a float cuando el frontend espere un number.
-- =============================================================

-- Usuarios: email único, password con hash (lo genera auth de P3).
-- nombre/apellido/DNI: identificación del titular (acuerdo del equipo, 03/09/2026).
-- Son nullable para no romper los usuarios ya creados en Railway y para que
-- createUser({email, password}) de tests siga funcionando; el registro nuevo
-- (frontend) debe enviarlos.
-- dni UNIQUE: identificación, no puede repetirse.
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  first_name VARCHAR(120),
  last_name  VARCHAR(120),
  dni        VARCHAR(20)  UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Wallets: una por usuario (UNIQUE) porque las funciones del contrato
-- son findByUserId/getWalletByUserId en singular.
CREATE TABLE IF NOT EXISTS wallets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice de búsqueda frecuente: findWalletByUserId.
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets (user_id);

-- Balances: moneda + monto por wallet. UNIQUE(wallet_id, currency)
-- evita duplicar una misma moneda en una misma wallet.
CREATE TABLE IF NOT EXISTS balances (
  id         SERIAL PRIMARY KEY,
  wallet_id  INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  currency   VARCHAR(3)  NOT NULL CHECK (currency IN ('USD', 'EUR', 'COP')),
  amount     NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_balances_wallet_currency UNIQUE (wallet_id, currency)
);

-- Índice de búsqueda frecuente: findBalancesByWalletId, GET /api/balances.
CREATE INDEX IF NOT EXISTS idx_balances_wallet_id ON balances (wallet_id);

-- Transactions: modelo Sprint 2 (contrato maestro de P3), ADITIVO sobre Sprint 1.
-- Contrato maestro: `currency` = moneda origen, `amount` = monto origen,
-- `type` = tipo de operación (buy | sell | exchange). Se CONSERVAN esas
-- columnas y solo se AGREGAN las que faltan para el Sprint 2:
--   to_currency (moneda destino), to_amount (monto destino), rate (tasa),
--   status (estado). Las columnas nuevas son NULLABLE a propósito para no
-- romper el historial de Sprint 1 (las operaciones viejas no las tenían).
-- El frontend no crea transacciones libres: se generan automáticamente al
-- completarse una compra/venta/intercambio (exchange).
CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id   INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL,                              -- buy | sell | exchange
  currency    VARCHAR(3)  NOT NULL CHECK (currency IN ('USD','EUR','COP')), -- moneda origen
  amount      NUMERIC(18,2) NOT NULL,                            -- monto origen
  to_currency VARCHAR(3)  CHECK (to_currency IN ('USD','EUR','COP')),   -- moneda destino
  to_amount   NUMERIC(18,2),                                     -- monto destino
  rate        NUMERIC(18,6),                                     -- tasa aplicada origen -> destino
  status      VARCHAR(20) NOT NULL DEFAULT 'completed',          -- completed | failed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de búsqueda frecuente: findTransactionsByUserId y por wallet.
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions (wallet_id);

-- Goals / Metas de viaje (Sprint 2 · Etapa 3 — P2).
-- Cada meta pertenece a un usuario (user_id) y se define en UNA moneda del
-- contrato (USD/EUR/COP) con un monto objetivo (target_amount > 0).
-- current_amount guarda cuánto lleva ahorrado hacia la meta; el progreso
-- (progreso/completada) se calcula en la capa de servicio, no se almacena,
-- evitando estados inconsistentes. El historial de aportes y la asignación
-- desde balances reales quedan para etapas posteriores (a coordinar).
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

-- Índice de búsqueda frecuente: listGoalsByUserId, GET /api/goals.
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals (user_id);