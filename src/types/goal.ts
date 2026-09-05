import type { Currency } from "./currency";

/**
 * Meta / objetivo de viaje (Sprint 2 · Etapa 3).
 * La meta se define en UNA moneda del contrato con un monto objetivo.
 * `progress` (0-100) y `completed` se derivan de current/target; el
 * repositorio traduce la fila SQL y la capa de servicio es la dueña de
 * la regla de negocio que los calcula para el objeto de dominio.
 */
export interface Goal {
  id: number;
  userId: number;
  name: string;
  currency: Currency;
  targetAmount: number;
  currentAmount: number;
  progress: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalInput {
  userId: number;
  name: string;
  currency: Currency;
  targetAmount: number;
}

export interface AddToGoalInput {
  userId: number;
  goalId: number;
  amount: number;
}