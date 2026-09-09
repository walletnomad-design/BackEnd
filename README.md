# NomadWallet — Backend

API de NomadWallet (Proyecto Final · Soy Henry). Backend en **Express + TypeScript + PostgreSQL (Railway)**.

## Stack

- **Express 5** + **TypeScript** (strict, sin `any`)
- **PostgreSQL** hosteado en **Railway** (`pg`), migraciones con SQL puro (`tsx`)
- **Vitest** + **PGlite** (PostgreSQL en memoria) para la suite de tests sin base real
- **CurrencyFreaks** (tasas reales) y **Google Gemini** (chatbot Nomad AI) como proveedores externos

## Estructura

```
src/
  db/            Esquema SQL, conexión (Pool), migración, alter y check
  types/         Tipos de dominio y DTOs de respuesta (contrato con P1/P3)
  repositories/  Consultas SQL por entidad (funciones congeladas del contrato)
  services/      Reglas de negocio (auth, wallet, balance, transactions, exchange,
                 rates, goals, rate-alert, money-ops, email-operation, ai-context, admin)
  controllers/   Capa HTTP de la API
  routes/        Definición de rutas (montadas en app.ts)
  middlewares/   requireAuth (JWT) y requireAdmin
  tests/         Suite Vitest (102 tests) + setup con PGlite
```

## Puesta en marcha

1. `npm install`
2. Crear `.env` a partir de `.env.example`:

   ```
   DATABASE_URL=postgresql://...   # conexión a Railway (con ?sslmode=require)
   JWT_SECRET=...                  # secreto compartido con el equipo para login
   CURRENCYFREAKS_API_KEY=...      # tasas reales (plan free: base USD)
   GEMINI_API_KEY=...              # chatbot Nomad AI (gemini-2.5-flash)
   PORT=3000                       # opcional, default 3000
   ```

   > `.env` está en `.gitignore` y **nunca se sube**. En el repositorio solo vive `.env.example` con los nombres de variables, sin valores reales.
3. Migrar y verificar la base:

   ```
   npm run db:migrate   # crea users, wallets, balances, transactions, rate_alerts, goals
   npm run db:alter     # aplica alter-*.sql a una base existente (Railway)
   npm run db:check     # verifica conexión a PostgreSQL
   ```

4. Correr:

   ```
   npm run dev          # arranca la API (tsx)
   npm run typecheck    # TypeScript estricto
   npm test             # suite Vitest (102 tests, PGlite)
   npm run build        # compila a dist/
   ```

## Endpoints

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | público | Registro (email, password, first/last name, dni) |
| POST | `/api/auth/login` | público | Login, devuelve JWT |
| GET | `/api/wallet` | JWT | Billetera del usuario |
| GET | `/api/balances` | JWT | Balances por moneda (USD/EUR/COP) |
| GET | `/api/transactions` | JWT | Historial de transacciones |
| GET | `/api/rates?from=USD` | JWT | Tasas (CurrencyFreaks + caché + fallback) |
| POST | `/api/exchange` | JWT | Compra/venta/intercambio (transaccional) |
| GET/POST | `/api/goals` | JWT | Listar / crear metas de viaje |
| POST | `/api/goals/:id/contributions` | JWT | Aportar saldo real a una meta |
| POST | `/api/goals/:id/withdrawals` | JWT | Retirar de una meta |
| DELETE | `/api/goals/:id` | JWT | Eliminar meta |
| GET/POST | `/api/rate-alerts` | JWT | Listar / crear alertas de tasa |
| POST | `/api/rate-alerts/evaluate` | JWT | Evaluar alertas del usuario contra la tasa actual |
| POST | `/api/rate-alerts/:id/reactivate` | JWT | Rearmar una alerta disparada |
| DELETE | `/api/rate-alerts/:id` | JWT | Eliminar alerta |
| POST | `/api/deposits` | JWT | Depositar saldo a la billetera |
| POST | `/api/transfers` | JWT | Transferir a otro usuario |
| GET | `/api/admin/summary` | admin | Métricas del panel administrativo |
| POST | `/api/ai/chat` | JWT | Chatbot Nomad AI (definido en `ai.routes.ts`; **montaje pendiente en `app.ts`**) |

> `GET /` responde `{ message: "NomadWallet API funcionando" }` como health check.

---

## Modelo de datos — justificación

El dominio se modela en **seis tablas**: `users`, `wallets`, `balances`, `transactions`, `rate_alerts` y `goals`. Relaciones: **1 usuario → 1 wallet → N balances**, y **1 usuario → 1 wallet → N transactions**.

### `users`
| Columna     | Tipo                  | Reglas                         |
|-------------|-----------------------|--------------------------------|
| `id`        | `SERIAL PRIMARY KEY`  |                                |
| `email`     | `VARCHAR(255)`        | `NOT NULL`, `UNIQUE`           |
| `password`  | `VARCHAR(255)`        | `NOT NULL` (hash, lo genera P3)|
| `first_name`| `VARCHAR(120)`        | nullable (identidad, 03/09/2026)|
| `last_name` | `VARCHAR(120)`        | nullable                        |
| `dni`       | `VARCHAR(20)`         | `UNIQUE`, nullable              |
| `role`      | `VARCHAR(5)`          | `NOT NULL DEFAULT 'user'` CHECK (`'user'`/`'admin'`) |
| `created_at`| `TIMESTAMPTZ`         | `DEFAULT NOW()`                |

**Por qué:** `email UNIQUE` garantiza identidad única en el registro desde la propia base (defensa de última línea, tal como exige el contrato). `dni UNIQUE` hace lo propio para la identificación del titular. `role` habilita el panel admin sin tabla extra.

### `wallets`
| Columna     | Tipo                  | Reglas                                    |
|-------------|-----------------------|-------------------------------------------|
| `id`        | `SERIAL PRIMARY KEY`  |                                           |
| `user_id`   | `INTEGER`             | `NOT NULL`, `UNIQUE`, FK → `users(id)` `ON DELETE CASCADE` |
| `created_at`| `TIMESTAMPTZ`         | `DEFAULT NOW()`                          |

**Por qué:** cada usuario tiene **una sola billetera** (`user_id UNIQUE`). Las funciones congeladas del contrato son singulares (`findWalletByUserId`, `getWalletByUserId`): modelar "uno a uno" mantiene esa promesa sin ambigüedad.

### `balances`
| Columna     | Tipo                  | Reglas                                          |
|-------------|-----------------------|-------------------------------------------------|
| `id`        | `SERIAL PRIMARY KEY`  |                                                 |
| `wallet_id` | `INTEGER`             | `NOT NULL`, FK → `wallets(id)` `ON DELETE CASCADE` |
| `currency`  | `VARCHAR(3)`          | `CHECK (currency IN ('USD','EUR','COP'))`       |
| `amount`    | `NUMERIC(18,2)`       | `NOT NULL DEFAULT 0`, `CHECK (amount >= 0)`     |
| `created_at`| `TIMESTAMPTZ`         | `DEFAULT NOW()`                                |
| `updated_at`| `TIMESTAMPTZ`         | `DEFAULT NOW()`                                |
| constraint  | `UNIQUE (wallet_id, currency)` |                                          |

**Por qué:**
- `UNIQUE (wallet_id, currency)` evita **duplicar una misma moneda en la misma wallet** — no puede existir "USD dos veces".
- `amount NUMERIC(18,2)`: los montos son **dinero**, se guardan en tipo exacto (nunca `FLOAT`/`REAL`). Los repositorios castean a `float8` al leer para que el frontend reciba `number`.
- `CHECK (currency IN ...)` garantiza en base que solo se guarden las monedas soportadas (USD, EUR, COP).
- Los saldos **arrancan en 0** al registrarse (Sprint 3): el usuario empieza depósito/transferencia con saldo real desde el primer día.

### `transactions`
| Columna       | Tipo            | Reglas                                            |
|---------------|-----------------|---------------------------------------------------|
| `id`          | `SERIAL PRIMARY KEY` |                                             |
| `user_id`     | `INTEGER`       | `NOT NULL`, FK → `users(id)` `ON DELETE CASCADE` |
| `wallet_id`   | `INTEGER`       | `NOT NULL`, FK → `wallets(id)` `ON DELETE CASCADE` |
| `to_user_id`  | `INTEGER`       | FK → `users(id)` `ON DELETE SET NULL` — destinatario en transferencias |
| `type`        | `VARCHAR(20)`   | `NOT NULL` — `buy`/`sell`/`exchange`/`deposit`/`transfer` |
| `currency`    | `VARCHAR(3)`    | `NOT NULL`, moneda origen (`CHECK ...`)           |
| `amount`      | `NUMERIC(18,2)` | `NOT NULL`, monto origen                          |
| `to_currency` | `VARCHAR(3)`    | moneda destino (`exch`/`transfer`)                |
| `to_amount`   | `NUMERIC(18,2)` | monto destino                                     |
| `rate`        | `NUMERIC(18,6)` | tasa aplicada origen → destino                    |
| `status`      | `VARCHAR(20)`   | `NOT NULL DEFAULT 'completed'` (`completed`/`failed`) |
| `created_at`  | `TIMESTAMPTZ`   | `DEFAULT NOW()`                                   |

**Por qué:** las columnas del Sprint 1 (`currency`, `amount`, `type`) son el **contrato maestro**: se conservan intactas y solo se **agregan** las necesarias (`to_currency`, `to_amount`, `rate`, `status`), nullable para no romper el historial viejo. En Sprint 3 se suma `to_user_id`: para que el histórico de cada usuario mire `user_id OR to_user_id` en transferencias.

### `rate_alerts`
| Columna       | Tipo            | Reglas                                        |
|---------------|-----------------|-----------------------------------------------|
| `id`          | `SERIAL PRIMARY KEY` |                                           |
| `user_id`     | `INTEGER`       | `NOT NULL`, FK → `users(id)` `ON DELETE CASCADE` |
| `from_currency`| `VARCHAR(3)`   | `NOT NULL`, denom. de partida                 |
| `to_currency` | `VARCHAR(3)`    | `NOT NULL`, denom. destino (`<>` partida)     |
| `threshold`   | `NUMERIC(18,6)` | `NOT NULL CHECK (> 0)` — umbral               |
| `condition`   | `VARCHAR(3)`    | `NOT NULL DEFAULT 'gte'` — `gte`/`lte`        |
| `status`      | `VARCHAR(10)`   | `NOT NULL DEFAULT 'active'` — `active`/`triggered` |
| `created_at`/`updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()`                        |

**Por qué:** `status` es una mini-máquina de estados (`active → triggered`, rearmable) evaluada por `evaluateRateAlerts`. El envío del aviso (email/socket) queda para la capa de P3/P1.

### `goals`
| Columna          | Tipo            | Reglas                                          |
|------------------|-----------------|-------------------------------------------------|
| `id`             | `SERIAL PRIMARY KEY` |                                           |
| `user_id`        | `INTEGER`       | `NOT NULL`, FK → `users(id)` `ON DELETE CASCADE` |
| `name`           | `VARCHAR(120)`  | `NOT NULL`                                      |
| `currency`       | `VARCHAR(3)`    | `NOT NULL`, una del contrato                    |
| `target_amount`  | `NUMERIC(18,2)` | `NOT NULL CHECK (> 0)`                          |
| `current_amount` | `NUMERIC(18,2)` | `NOT NULL DEFAULT 0 CHECK (>= 0)`               |
| `created_at`/`updated_at` | `TIMESTAMPTZ` | `DEFAULT NOW()`                          |

**Por qué:** el progreso de la meta se **calcula en el servicio** (`current_amount / target_amount`), no se almacena: evita estados inconsistentes entre meta y saldo.

### Decisiones transversales

| Decisión | Justificación |
|----------|---------------|
| **`SERIAL` (int) para `id`** | `pg` devuelve `int8`/`BIGINT` como **string**; con enteros (int32) el `id` llega como `number` y el JSON del frontend es más predecible. |
| **`snake_case` en la base, `camelCase` en la API** | La base sigue convención SQL (`user_id`); cada repositorio mapea a `userId`/`walletId` en el dominio y las respuestas, respetando el contrato con P1/P3. |
| **Foreign keys con `ON DELETE CASCADE`** | Borrar un usuario limpia su wallet, saldos y movimientos; evita registros huérfanos y facilita pruebas. `to_user_id` usa `SET NULL` para conservar el historial del remitente. |
| **Índices en búsquedas frecuentes** | `idx_wallets_user_id`, `idx_balances_wallet_id`, `idx_transactions_user_id`, `idx_transactions_wallet_id`, `idx_transactions_to_user_id`, `idx_rate_alerts_user_id`, `idx_goals_user_id`: los `WHERE` más usados no hacen scan de tabla completa. |
| **Migraciones aditivas (`alter-*.sql`)** | Bases viejas en Railway se actualizan sin tocar columnas congeladas; `db:alter` las descubre y aplica en orden. |
| **Consultas parametrizadas `$1, $2…`** | Toda consulta se construye con parámetros posicionales; **nunca** concatenando datos del usuario → protección contra inyección SQL. |
| **Errores con `{ error, message }`** | Formato único de errores de la API (contrato); los errores de negocio (saldo insuficiente, wallet inexistente, etc.) son clases tipadas que el controller traduce a códigos HTTP. |
| **Transacciones con `BEGIN/COMMIT/ROLLBACK`** | Compra/venta, aportes, depósitos y transferencias actualizan saldos y crean la transacción en el mismo bloque: nunca queda a medias. |
| **Capa por responsabilidad** | Controller (HTTP) → Service (reglas) → Repository (SQL). La capa HTTP no toca SQL directo. |
| **Tasas siempre reales con base USD** | CurrencyFreaks (plan free) solo calcula con base USD: se consulta así siempre y el servicio normaliza a la moneda pedida (`normalized[target] = usdRates[target] / usdRates[base]`), con caché de 5 min y fallback de emergencia. |

## Tests

Suite Vitest sobre repositorios y servicios (**102 tests** en 11 archivos) ejecutándose contra **PGlite**, un PostgreSQL real en memoria que carga el mismo `schema.sql`, sin depender de Railway ni credenciales.

```
npm test      # suite completa
```

## Miembros

- **P1** — Frontend (React + TypeScript)
- **P2** — Backend: PostgreSQL, tipos, repositorios y servicios de datos
- **P3** — Backend: Express, autenticación JWT y endpoints