import type { Pool, PoolClient } from "pg";

export type Queryable = Pick<Pool, "query">;

/** Unidad que sabe ejecutar queries (pool o cliente de transacción). */
export type QueryLike = Pick<PoolClient, "query">;

/** Objeto que puede entregar un cliente dedicado para transacción. */
export type Connector = Pick<Pool, "connect">;

/**
 * Ejecuta `fn` dentro de una transacción (BEGIN / COMMIT / ROLLBACK).
 *
 * - Si `db` tiene `connect()` (Pool de pg en producción), toma un cliente
 *   dedicado para la transacción y lo libera al final.
 * - Si no (PGlite en tests), usa `db` directamente como cliente, ejecutando
 *   BEGIN/COMMIT/ROLLBACK como queries.
 *
 * Garantiza que si `fn` lanza, se hace ROLLBACK y no queda dinero descontado
 * sin acreditar (regla del contrato maestro).
 */
export async function withTransaction<T>(
  db: Queryable & Partial<Connector>,
  fn: (client: QueryLike) => Promise<T>
): Promise<T> {
  const client = db.connect ? await db.connect() : (db as QueryLike);
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Si el ROLLBACK falla (conexión rota), no enmascarar el error original.
    }
    throw err;
  } finally {
    if (db.connect) {
      const released = client as { release?: () => void };
      released.release?.();
    }
  }
}
