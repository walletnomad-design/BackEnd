# NomadWallet — Backend

API de NomadWallet (Proyecto Final · Soy Henry). Backend en **Express + TypeScript + PostgreSQL (Railway)**.

## Stack

- **Express 5** + **TypeScript** (strict, sin `any`)
- **PostgreSQL** hosteado en **Railway** (`pg`), migraciones con SQL puro (`tsx`)
- **Vitest** para tests, **PGlite** (PostgreSQL en memoria) para pruebas sin base real

## Estructura

```
src/
  db/            Esquema SQL, conexión (Pool), migración y check
  types/         Tipos de dominio y DTOs de respuesta (contrato con P1/P3)
  repositories/  Consultas SQL por entidad (funciones congeladas del contrato)
  services/      Reglas de negocio (walletService, balanceService)
  controllers/   Capa HTTP de la API (P3)
  routes/        Definición de rutas (P3)
  middlewares/   Auth JWT (P3)
  tests/         Suite Vitest (22 tests)
```

## Puesta en marcha

1. `npm install`
2. Crear `.env` a partir de `.env.example`:

   ```
   DATABASE_URL=postgresql://...   # conexión a Railway (pública, con ?sslmode=require)
   JWT_SECRET=...                  # secreto compartido con el equipo para login
   ```

   > `.env` está en `.gitignore` y **nunca se sube**. En el repositorio solo vive `.env.example` con los nombres de variables, sin valores reales.
3. Migrar y verificar la base:

   ```
   npm run db:migrate   # crea users, wallets, balances, transactions
   npm run db:check     # verifica conexión a PostgreSQL
   ```

4. Correr:

   ```
   npm run dev          # arranca la API (tsx)
   npm run typecheck    # TypeScript estricto
   npm test             # suite Vitest (22 tests, PGlite)
   npm run build        # compila a dist/
   ```

---

## Modelo de datos — justificación

El dominio se modela en **cuatro tablas**, una por entidad del contrato fijo: `users`, `wallets`, `balances`, `transactions`. Relaciones: **1 usuario → 1 wallet → N balances**, y **1 usuario → N transactions**.

### `users`
| Columna     | Tipo                  | Reglas                         |
|-------------|-----------------------|--------------------------------|
| `id`        | `SERIAL PRIMARY KEY`  |                              |
| `email`     | `VARCHAR(255)`        | `NOT NULL`, `UNIQUE`           |
| `password`  | `VARCHAR(255)`        | `NOT NULL` (hash, lo genera P3)|
| `created_at`| `TIMESTAMPTZ`         | `DEFAULT NOW()`                |

**Por qué:** `email UNIQUE` garantiza identidad única en el registro desde la propia base (defensa de última línea aunque la app lo valide antes), tal como exige el contrato y pesa en la rúbrica.

### `wallets`
| Columna     | Tipo                  | Reglas                                    |
|-------------|-----------------------|-------------------------------------------|
| `id`        | `SERIAL PRIMARY KEY`  |                                           |
| `user_id`   | `INTEGER`             | `NOT NULL`, `UNIQUE`, FK → `users(id)` `ON DELETE CASCADE` |

**Por qué:** cada usuario tiene **una sola billetera** (`user_id UNIQUE`). Las funciones congeladas del contrato son singulares (`findWalletByUserId`, `getWalletByUserId`): modelar "uno a uno" mantiene esa promesa sin ambigüedad (nunca "¿cuál de sus wallets?").

### `balances`
| Columna     | Tipo                  | Reglas                                          |
|-------------|-----------------------|-------------------------------------------------|
| `id`        | `SERIAL PRIMARY KEY`  |                                                 |
| `wallet_id` | `INTEGER`             | `NOT NULL`, FK → `wallets(id)` `ON DELETE CASCADE` |
| `currency`  | `VARCHAR(3)`          | `CHECK (currency IN ('USD','EUR','COP'))`       |
| `amount`    | `NUMERIC(18,2)`       | `NOT NULL`, `CHECK (amount >= 0)`               |
| `created_at`| `TIMESTAMPTZ`         | `DEFAULT NOW()`                                |
| `updated_at`| `TIMESTAMPTZ`         | `DEFAULT NOW()`                                |
| constraint  | `UNIQUE (wallet_id, currency)` |                                              |

**Por qué:**
- `UNIQUE (wallet_id, currency)` evita **duplicar una misma moneda en la misma wallet** — no puede existir "USD dos veces". Es la regla de la rúbrica (constraint único compuesto).
- `amount NUMERIC(18,2)`: los montos son **dinero**, así que se guardan en tipo numérico exacto (nunca `FLOAT`/`REAL`, que pierden precisión con decimales). El script de migración castea a `float8` al leer para que el frontend reciba `number` y no texto.
- `CHECK (currency IN ...)` garantiza en base que solo se guarden las monedas soportadas (Sprint 1: USD, EUR, COP).
- Saldo inicial ficticio por wallet: **USD 1000 / EUR 500 / COP 2.000.000**, insertado en una sola operación por `createInitialBalances()`, seteando usuarios con datos demostrables en la demo.

### `transactions`
| Columna     | Tipo           | Reglas                                            |
|-------------|----------------|---------------------------------------------------|
| `id`        | `SERIAL PRIMARY KEY` |                                              |
| `user_id`   | `INTEGER`      | `NOT NULL`, FK → `users(id)` `ON DELETE CASCADE` |
| `wallet_id` | `INTEGER`      | `NOT NULL`, FK → `wallets(id)` `ON DELETE CASCADE` |
| `currency`  | `VARCHAR(3)`   | `CHECK (currency IN ('USD','EUR','COP'))`         |
| `amount`    | `NUMERIC(18,2)`| `NOT NULL`                                        |
| `type`      | `VARCHAR(20)`  | `NOT NULL` (compra/venta/intercambio)             |
| `created_at`| `TIMESTAMPTZ`  | `DEFAULT NOW()`                                   |

**Por qué:** en **Sprint 1** la tabla se crea y soporta `findTransactionsByUserId` (historial), pero **la lógica de negocio de las transacciones es de Sprint 2** (fuera de alcance). Se dejan las FKs desde ya para no modificar el esquema cuando llegue esa funcionalidad.

### Decisiones transversales

| Decisión | Justificación |
|----------|---------------|
| **`SERIAL` (int) para `id`** | `pg` devuelve los tipos `int8`/`BIGINT` como **string**; con enteros (int32) el `id` llega como `number` y el JSON del frontend es más predecible. |
| **`snake_case` en la base, `camelCase` en la API** | La base sigue convención SQL (`user_id`); cada repositorio mapea a `userId`/`walletId` en el dominio y las respuestas, respetando el contrato con P1/P3 sin renunciar a buenas prácticas de BD. |
| **Foreign keys con `ON DELETE CASCADE`** | Borrar un usuario limpia su wallet, saldos y movimientos; evita registros huérfanos y facilita pruebas. |
| **Índices en búsquedas frecuentes** | `idx_wallets_user_id`, `idx_balances_wallet_id`, `idx_transactions_user_id`, `idx_transactions_wallet_id`: los `WHERE` más usados (buscar por usuario/wallet) no hacen scan de tabla completa. |
| **Consultas parametrizadas `$1, $2…`** | Toda consulta se construye con parámetros posicionales; **nunca** concatenando datos del usuario → protección contra inyección SQL. |
| **Errores con `{ error, message }`** | Formato único de errores de la API (contrato), incluyendo el `WalletNotFoundError` del dominio cuando el usuario no tiene wallet. |
| **Capa por responsabilidad** | Controller (HTTP) → Service (reglas) → Repository (SQL). La API de P3 nunca toca SQL directo. |

## Tests

Suite Vitest sobre repositorios y servicios (22 tests) ejecutándose contra **PGlite**, un PostgreSQL real en memoria que carga el mismo `schema.sql`, sin depender de Railway ni credenciales.

```
npm test      # suite completa
```

## Miembros

- **P1** — Frontend (React + TypeScript)
- **P2** — Backend: PostgreSQL, tipos, repositorios y servicios de datos
- **P3** — Backend: Express, autenticación JWT y endpoints