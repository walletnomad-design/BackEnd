/**
 * Conexión a PostgreSQL (Railway).
 *
 * Usa la variable DATABASE_URL del archivo .env (ver .env.example).
 * Si la URL trae ?sslmode=require activa SSL con aceptación del certificado
 * propio de Railway; si no la trae, conecta sin SSL.
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

const useSSL = DATABASE_URL.includes("sslmode=require");

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
});