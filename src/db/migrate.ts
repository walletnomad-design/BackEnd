/**
 * Migración: aplica src/db/schema.sql contra PostgreSQL (Railway)
 * y, si existe, las migraciones aditivas de src/db/alter-*.sql
 * (Sprint 2: amplía transactions sin tocar currency/amount/type).
 * Uso:  DATABASE_URL=... npm run db:migrate
 * La conexión sale de backend/.env (ver .env.example).
 * Para aplicar SOLO el alter aditivo: npm run db:alter.
 */
import fs from "node:fs";
import path from "node:path";
import { pool } from "./connection";

async function migrate(): Promise<void> {
  const schemaPath = path.join(__dirname, "schema.sql");
  const alterPath = path.join(__dirname, "alter-transactions.sql");

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`No encontré el esquema en ${schemaPath}`);
  }

  const schema = fs.readFileSync(schemaPath, "utf8");
  const additive = fs.existsSync(alterPath)
    ? fs.readFileSync(alterPath, "utf8")
    : "";

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(schema);
    if (additive) {
      await client.query(additive);
    }
    await client.query("COMMIT");
    console.log("Migración aplicada:");
    console.log("  - users");
    console.log("  - wallets");
    console.log("  - balances");
    console.log("  - transactions (esquema + alter aditivo Sprint 2)");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err: unknown) => {
  console.error("Error al migrar:", err);
  process.exit(1);
});