import type { CreateUserInput, User } from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "./queryable";

interface UserRow {
  id: number;
  email: string;
  password: string;
  first_name: string | null;
  last_name: string | null;
  dni: string | null;
  created_at: string | Date;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  password: row.password,
  firstName: row.first_name ?? undefined,
  lastName: row.last_name ?? undefined,
  dni: row.dni ?? undefined,
  createdAt: new Date(row.created_at).toISOString(),
});

export const findUserByEmail = async (
  email: string,
  db: Queryable = pool
): Promise<User | null> => {
  const result = await db.query<UserRow>(
    "SELECT id, email, password, first_name, last_name, dni, created_at FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0] ? toUser(result.rows[0]) : null;
};

export const createUser = async (
  data: CreateUserInput,
  db: Queryable = pool
): Promise<User> => {
  const result = await db.query<UserRow>(
    `INSERT INTO users (email, password, first_name, last_name, dni)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, password, first_name, last_name, dni, created_at`,
    [data.email, data.password, data.firstName ?? null, data.lastName ?? null, data.dni ?? null]
  );
  return toUser(result.rows[0]);
};