/**
 * Migración: aplica src/db/schema.sql contra PostgreSQL (Railway)
 * y, si existen, todas las migraciones aditivas de src/db/alter-*.sql
 * (Sprint 2: amplía transactions sin tocar currency/amount/type; crea
 * la tabla de metas de viaje).
 * Uso:  DATABASE_URL=... npm run db:migrate
 * La conexión sale de backend/.env (ver .env.example).
 * Para aplicar SOLO el alter de transactions: npm run db:alter.
 */
import fs from "node:fs";
import path from "node:path";
import { pool } from "./connection";

async function alterFiles(): Promise<string[]> {
  const dir = __dirname;
  return fs
    .readdirSync(dir)
    .filter((file) => /^alter-.*\.sql$/.test(file))
    .sort()
    .map((file) => path.join(dir, file))
    .filter((file) => fs.existsSync(file));
}

async function migrate(): Promise<void> {
  const schemaPath = path.join(__dirname, "schema.sql");

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`No encontré el esquema en ${schemaPath}`);
  }

  const schema = fs.readFileSync(schemaPath, "utf8");
  const alters = await alterFiles();
  const additive = alters.map((file) => fs.readFileSync(file, "utf8"));

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(schema);
    for (const alter of additive) {
      await client.query(alter);
    }
    await client.query("COMMIT");
    console.log("Migración aplicada:");
    console.log("  - users");
    console.log("  - wallets");
    console.log("  - balances");
    console.log("  - transactions (esquema + alter aditivo Sprint 2)");
    for (const file of alters) {
      console.log(`  - ${path.basename(file)}`);
    }
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