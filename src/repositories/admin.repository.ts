import type {
  TransactionCountByType,
  TransactionVolumeByCurrency,
} from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "./queryable";

interface CountRow {
  count: number;
}

interface VolumeRow {
  currency: TransactionVolumeByCurrency["currency"];
  count: number;
  total_amount: number;
}

interface TypeRow {
  type: TransactionCountByType["type"];
  count: number;
}

const toCount = (rows: CountRow[]): number => rows[0]?.count ?? 0;

export const countUsers = (db: Queryable = pool): Promise<number> =>
  db
    .query<CountRow>("SELECT COUNT(*)::int AS count FROM users")
    .then((r) => toCount(r.rows));

export const countUsersByRole = (
  role: "user" | "admin",
  db: Queryable = pool
): Promise<number> =>
  db
    .query<CountRow>("SELECT COUNT(*)::int AS count FROM users WHERE role = $1", [role])
    .then((r) => toCount(r.rows));

export const countTransactions = (db: Queryable = pool): Promise<number> =>
  db
    .query<CountRow>("SELECT COUNT(*)::int AS count FROM transactions")
    .then((r) => toCount(r.rows));

export const sumVolumeByCurrency = async (
  db: Queryable = pool
): Promise<TransactionVolumeByCurrency[]> => {
  const result = await db.query<VolumeRow>(
    `SELECT currency,
            COUNT(*)::int AS count,
            COALESCE(SUM(amount), 0)::float8 AS total_amount
     FROM transactions
     GROUP BY currency
     ORDER BY currency`
  );
  return result.rows.map((row) => ({
    currency: row.currency,
    count: row.count,
    totalAmount: row.total_amount,
  }));
};

export const countTransactionsByType = async (
  db: Queryable = pool
): Promise<TransactionCountByType[]> => {
  const result = await db.query<TypeRow>(
    `SELECT type, COUNT(*)::int AS count
     FROM transactions
     GROUP BY type
     ORDER BY type`
  );
  return result.rows.map((row) => ({ type: row.type, count: row.count }));
};

export const countRateAlertsByStatus = (
  status: "active" | "triggered",
  db: Queryable = pool
): Promise<number> =>
  db
    .query<CountRow>("SELECT COUNT(*)::int AS count FROM rate_alerts WHERE status = $1", [
      status,
    ])
    .then((r) => toCount(r.rows));

export const countGoals = (db: Queryable = pool): Promise<number> =>
  db
    .query<CountRow>("SELECT COUNT(*)::int AS count FROM goals")
    .then((r) => toCount(r.rows));

/**
 * Cantidad de metas que ya alcanzaron (o superaron) su objetivo.
 * `current_amount >= target_amount` es la regla del contrato para
 * considerar una meta como completada.
 */
export const countCompletedGoals = (db: Queryable = pool): Promise<number> =>
  db
    .query<CountRow>(
      `SELECT COUNT(*)::int AS count
       FROM goals
       WHERE current_amount >= target_amount`
    )
    .then((r) => toCount(r.rows));