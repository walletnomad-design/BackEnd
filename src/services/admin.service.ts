import type { AdminMetrics } from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "../repositories/queryable";
import {
  countCompletedGoals,
  countGoals,
  countRateAlertsByStatus,
  countTransactions,
  countTransactionsByType,
  countUsers,
  countUsersByRole,
  sumVolumeByCurrency,
} from "../repositories";

/**
 * Métricas globales del panel administrativo. Son agregados de TODA la
 * base (sin aislamiento por usuario): solo se exponen detrás del middleware
 * `requireAdmin` de P3. Los conteos y sumas se resuelven en queries únicas
 * sobre PostgreSQL (COUNT/SUM), no en memoria, para que no importe el
 * volumen de datos.
 */
export const getAdminMetrics = async (
  db: Queryable = pool
): Promise<AdminMetrics> => {
  const [
    totalUsers,
    adminUsers,
    totalTransactions,
    volumeByCurrency,
    transactionsByType,
    triggeredAlerts,
    activeAlerts,
    totalGoals,
    completedGoals,
  ] = await Promise.all([
    countUsers(db),
    countUsersByRole("admin", db),
    countTransactions(db),
    sumVolumeByCurrency(db),
    countTransactionsByType(db),
    countRateAlertsByStatus("triggered", db),
    countRateAlertsByStatus("active", db),
    countGoals(db),
    countCompletedGoals(db),
  ]);

  return {
    totalUsers,
    adminUsers,
    totalTransactions,
    volumeByCurrency,
    transactionsByType,
    triggeredAlerts,
    activeAlerts,
    totalGoals,
    completedGoals,
  };
};