import type { CreateGoalInput, Currency, Goal } from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "./queryable";

interface GoalRow {
  id: number;
  user_id: number;
  name: string;
  currency: Currency;
  target_amount: number;
  current_amount: number;
  created_at: string | Date;
  updated_at: string | Date;
}

const toGoal = (row: GoalRow): Goal => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  currency: row.currency,
  targetAmount: row.target_amount,
  currentAmount: row.current_amount,
  progress: 0,
  completed: false,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export const createGoal = async (
  data: CreateGoalInput,
  db: Queryable = pool
): Promise<Goal> => {
  const result = await db.query<GoalRow>(
    `INSERT INTO goals (user_id, name, currency, target_amount, current_amount)
     VALUES ($1, $2, $3, $4, 0)
     RETURNING id, user_id, name, currency,
               target_amount::float8 AS target_amount,
               current_amount::float8 AS current_amount,
               created_at, updated_at`,
    [data.userId, data.name, data.currency, data.targetAmount]
  );
  return toGoal(result.rows[0]);
};

export const findGoalsByUserId = async (
  userId: number,
  db: Queryable = pool
): Promise<Goal[]> => {
  const result = await db.query<GoalRow>(
    `SELECT id, user_id, name, currency,
            target_amount::float8 AS target_amount,
            current_amount::float8 AS current_amount,
            created_at, updated_at
     FROM goals
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC`,
    [userId]
  );
  return result.rows.map(toGoal);
};

export const findGoalById = async (
  goalId: number,
  db: Queryable = pool
): Promise<Goal | null> => {
  const result = await db.query<GoalRow>(
    `SELECT id, user_id, name, currency,
            target_amount::float8 AS target_amount,
            current_amount::float8 AS current_amount,
            created_at, updated_at
     FROM goals
     WHERE id = $1`,
    [goalId]
  );
  return result.rows[0] ? toGoal(result.rows[0]) : null;
};

/**
 * Suma `amount` al ahorro actual de la meta, SOLO si la meta pertenece al
 * `userId` dado (búsqueda de propiedad en una sola query, sin carrera de
 * chequear y luego actualizar). Devuelve null si no existe o no es del
 * usuario: la capa de servicio lanza el error de negocio.
 */
export const addToGoalAmount = async (
  goalId: number,
  userId: number,
  amount: number,
  db: Queryable = pool
): Promise<Goal | null> => {
  const result = await db.query<GoalRow>(
    `UPDATE goals
     SET current_amount = current_amount + $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, name, currency,
               target_amount::float8 AS target_amount,
               current_amount::float8 AS current_amount,
               created_at, updated_at`,
    [goalId, userId, amount]
  );
  return result.rows[0] ? toGoal(result.rows[0]) : null;
};

export const deleteGoal = async (
  goalId: number,
  userId: number,
  db: Queryable = pool
): Promise<boolean> => {
  const result = await db.query(
    `DELETE FROM goals
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [goalId, userId]
  );
  return result.rows.length > 0;
};