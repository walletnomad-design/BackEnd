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
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
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

-- Transactions: se crea en Sprint 1 sin lógica (llega en Sprint 2).
-- FK a users y wallets para soportar findTransactionsByUserId y
-- las consultas de P3 por wallet. type queda NOT NULL: una transacción
-- siempre es de algún tipo (compra/venta/intercambio en Sprint 2).
CREATE TABLE IF NOT EXISTS transactions (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id  INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  currency   VARCHAR(3)  NOT NULL CHECK (currency IN ('USD', 'EUR', 'COP')),
  amount     NUMERIC(18,2) NOT NULL,
  type       VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de búsqueda frecuente: findTransactionsByUserId y por wallet.
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions (wallet_id);