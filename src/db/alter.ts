/**
 * Migración aditiva de Sprint 2: aplica src/db/alter-transactions.sql
 * contra PostgreSQL (Railway) para ampliar la tabla `transactions` sin
 * tocar currency/amount/type (contrato maestro). No altera nada más.
 * Uso:  DATABASE_URL=... npm run db:alter
 * La conexión sale de backend/.env (ver .env.example).
 */
import fs from "node:fs";
import path from "node:path";
import { pool } from "./connection";

async function alter(): Promise<void> {
  const alterPath = path.join(__dirname, "alter-transactions.sql");

  if (!fs.existsSync(alterPath)) {
    throw new Error(`No se encontró la migración aditiva en ${alterPath}`);
  }

  const alterSql = fs.readFileSync(alterPath, "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(alterSql);
    await client.query("COMMIT");
    console.log("Migración aditiva de transactions aplicada:");
    console.log("  - to_currency");
    console.log("  - to_amount");
    console.log("  - rate");
    console.log("  - status");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

alter().catch((err: unknown) => {
  console.error("Error al migrar:", err);
  process.exit(1);
});