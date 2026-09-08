import type { Currency } from "./currency";
import type { TransactionType } from "./transaction";

/** Volumen de transacciones agregado por moneda origen. */
export interface TransactionVolumeByCurrency {
  currency: Currency;
  count: number;
  totalAmount: number;
}

/** Cantidad de transacciones agregada por tipo de operación. */
export interface TransactionCountByType {
  type: TransactionType;
  count: number;
}

/**
 * Métricas globales del panel administrativo (GET /api/admin/summary).
 * Son agregados de toda la base (sin aislamiento por usuario): solo un
 * admin puede consultarlas (middleware `requireAdmin` de P3).
 */
export interface AdminMetrics {
  totalUsers: number;
  usersWithOperations: number;
  adminUsers: number;
  totalTransactions: number;
  volumeByCurrency: TransactionVolumeByCurrency[];
  transactionsByType: TransactionCountByType[];
  triggeredAlerts: number;
  activeAlerts: number;
  totalGoals: number;
  completedGoals: number;
}