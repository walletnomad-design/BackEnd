import type { CreateUserInput, User } from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "./queryable";

interface UserRow {
  id: number;
  email: string;
  password: string;
  created_at: string | Date;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  password: row.password,
  createdAt: new Date(row.created_at).toISOString(),
});

export const findUserByEmail = async (
  email: string,
  db: Queryable = pool
): Promise<User | null> => {
  const result = await db.query<UserRow>(
    "SELECT id, email, password, created_at FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0] ? toUser(result.rows[0]) : null;
};

export const createUser = async (
  data: CreateUserInput,
  db: Queryable = pool
): Promise<User> => {
  const result = await db.query<UserRow>(
    `INSERT INTO users (email, password)
     VALUES ($1, $2)
     RETURNING id, email, password, created_at`,
    [data.email, data.password]
  );
  return toUser(result.rows[0]);
};