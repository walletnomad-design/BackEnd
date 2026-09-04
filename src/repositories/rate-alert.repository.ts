import type {
  CreateRateAlertInput,
  Currency,
  RateAlert,
  RateAlertCondition,
  RateAlertStatus,
} from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "./queryable";

interface RateAlertRow {
  id: number;
  user_id: number;
  from_currency: Currency;
  to_currency: Currency;
  threshold: number;
  condition: RateAlertCondition;
  status: RateAlertStatus;
  created_at: string | Date;
  updated_at: string | Date;
}

const toRateAlert = (row: RateAlertRow): RateAlert => ({
  id: row.id,
  userId: row.user_id,
  fromCurrency: row.from_currency,
  toCurrency: row.to_currency,
  threshold: row.threshold,
  condition: row.condition,
  status: row.status,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export const createRateAlert = async (
  data: CreateRateAlertInput,
  db: Queryable = pool
): Promise<RateAlert> => {
  const result = await db.query<RateAlertRow>(
    `INSERT INTO rate_alerts
       (user_id, from_currency, to_currency, threshold, condition)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, from_currency, to_currency,
               threshold::float8 AS threshold, condition, status,
               created_at, updated_at`,
    [data.userId, data.fromCurrency, data.toCurrency, data.threshold, data.condition ?? "gte"]
  );
  return toRateAlert(result.rows[0]);
};

export const findRateAlertsByUserId = async (
  userId: number,
  db: Queryable = pool
): Promise<RateAlert[]> => {
  const result = await db.query<RateAlertRow>(
    `SELECT id, user_id, from_currency, to_currency,
            threshold::float8 AS threshold, condition, status,
            created_at, updated_at
     FROM rate_alerts
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC`,
    [userId]
  );
  return result.rows.map(toRateAlert);
};

export const findActiveRateAlertsByUserId = async (
  userId: number,
  db: Queryable = pool
): Promise<RateAlert[]> => {
  const result = await db.query<RateAlertRow>(
    `SELECT id, user_id, from_currency, to_currency,
            threshold::float8 AS threshold, condition, status,
            created_at, updated_at
     FROM rate_alerts
     WHERE user_id = $1 AND status = 'active'
     ORDER BY from_currency, to_currency`,
    [userId]
  );
  return result.rows.map(toRateAlert);
};

const setStatus = async (
  alertId: number,
  userId: number,
  status: RateAlertStatus,
  db: Queryable
): Promise<RateAlert | null> => {
  const result = await db.query<RateAlertRow>(
    `UPDATE rate_alerts
     SET status = $3, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, from_currency, to_currency,
               threshold::float8 AS threshold, condition, status,
               created_at, updated_at`,
    [alertId, userId, status]
  );
  return result.rows[0] ? toRateAlert(result.rows[0]) : null;
};

export const markRateAlertTriggered = async (
  alertId: number,
  userId: number,
  db: Queryable = pool
): Promise<RateAlert | null> => setStatus(alertId, userId, "triggered", db);

export const reactivateRateAlert = async (
  alertId: number,
  userId: number,
  db: Queryable = pool
): Promise<RateAlert | null> => setStatus(alertId, userId, "active", db);

export const deleteRateAlert = async (
  alertId: number,
  userId: number,
  db: Queryable = pool
): Promise<boolean> => {
  const result = await db.query(
    `DELETE FROM rate_alerts
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [alertId, userId]
  );
  return result.rows.length > 0;
};