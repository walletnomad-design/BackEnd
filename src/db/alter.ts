/**
 * Migraciones aditivas de Sprint 2 para aplicar contra PostgreSQL
 * (Railway) en bases que YA existen, sin tocar columnas congeladas.
 * Aplica, en una transacción:
 *   - alter-transactions.sql → transactions: to_currency, to_amount, rate, status
 *   - alter-users.sql        → users: first_name, last_name, dni (+ índice único)
 *   - alter-goals.sql        → goals: tabla de metas de viaje
 *   - alter-rate-alerts.sql  → rate_alerts: tabla de alertas de tasa
 *   - alter-user-role.sql    → users: role ('user'|'admin', default 'user')
 * Todas son idempotentes (ADD COLUMN IF NOT EXISTS / CREATE ... IF NOT EXISTS),
 * por eso se pueden re-ejecutar sin romper nada.
 * Uso:  DATABASE_URL=...  npm run db:alter
 * La conexión sale de backend/.env (ver .env.example).
 */
import fs from "node:fs";
import path from "node:path";
import { pool } from "./connection";

const ALTERS: { file: string; note: string }[] = [
  {
    file: "alter-transactions.sql",
    note: "transactions: to_currency, to_amount, rate, status",
  },
  {
    file: "alter-users.sql",
    note: "users: first_name, last_name, dni (indice unico)",
  },
  {
    file: "alter-goals.sql",
    note: "goals: tabla de metas de viaje",
  },
  {
    file: "alter-rate-alerts.sql",
    note: "rate_alerts: tabla de alertas de tasa",
  },
  {
    file: "alter-user-role.sql",
    note: "users: role ('user'|'admin', default 'user')",
  },
];

async function alter(): Promise<void> {
  const statements = ALTERS.map(({ file, note }) => {
    const alterPath = path.join(__dirname, file);
    if (!fs.existsSync(alterPath)) {
      throw new Error(`No se encontró la migración aditiva en ${alterPath}`);
    }
    return { sql: fs.readFileSync(alterPath, "utf8"), note };
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    for (const { sql } of statements) {
      await client.query(sql);
    }
    await client.query("COMMIT");
    console.log("Migraciones aditivas aplicadas:");
    for (const { note } of statements) {
      console.log(`  - ${note}`);
    }
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