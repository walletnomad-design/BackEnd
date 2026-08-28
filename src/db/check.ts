/**
 * Verificación de conectividad: SELECT NOW() contra PostgreSQL (Railway).
 * Uso:  npm run db:check
 * Si imprime la fecha/hora del servidor, la conexión está OK.
 */
import { pool } from "./connection";

async function checkConnection(): Promise<void> {
  const result = await pool.query("SELECT NOW() AS now");
  console.log("Conexión OK. Hora del servidor PostgreSQL:", result.rows[0].now);
  await pool.end();
}

checkConnection().catch((err: unknown) => {
  console.error("No se pudo conectar a la base de datos:", err);
  process.exit(1);
});