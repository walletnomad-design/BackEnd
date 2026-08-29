/**
 * Conexión a PostgreSQL (Railway).
 *
 * Usa la variable DATABASE_URL del archivo .env (ver .env.example).
 * Detecta si la URL exige SSL (por ?sslmode= o por ser host público de
 * Railway *.rlwy.net) y conecta aceptando el certificado propio de Railway.
 * El sslmode se extrae de la URL para que pg no lo reinterprete como
 * verify-full (que rechazaría el certificado autofirmado).
 */
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "Falta la variable DATABASE_URL. Copia backend/.env.example a backend/.env y completa el valor de la base en Railway."
  );
}

const parsed = new URL(DATABASE_URL);
const useSSL =
  parsed.searchParams.get("sslmode") != null ||
  parsed.hostname.endsWith(".rlwy.net");
parsed.searchParams.delete("sslmode");
parsed.searchParams.delete("sslrootcert");

export const pool = new Pool({
  connectionString: parsed.toString(),
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});