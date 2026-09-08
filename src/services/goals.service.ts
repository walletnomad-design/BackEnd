import type { AddToGoalInput, CreateGoalInput, Goal, Currency, WithdrawGoalInput } from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "../repositories/queryable";
import { withTransaction } from "../repositories/queryable";
import { getWalletByUserId } from "./wallet.service";
import {
  addToGoalAmount,
  subtractFromGoalAmount,
  createGoal as createGoalRow,
  deleteGoal as deleteGoalRow,
  findGoalById,
  findGoalsByUserId,
  addToBalance,
  getBalanceByWalletAndCurrency,
} from "../repositories";

export class GoalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoalValidationError";
  }
}

export class GoalNotFoundError extends Error {
  constructor(goalId: number) {
    super(`No existe la meta ${goalId} para este usuario`);
    this.name = "GoalNotFoundError";
  }
}

/**
 * Error de negocio cuando el balance del usuario no alcanza para aportar a una
 * meta. `available` es el máximo que se puede aportar en ese momento, para que
 * el controller lo devuelva en el mensaje (P3 pide "saldo insuficiente con el
 * máximo disponible").
 */
export class GoalInsufficientBalanceError extends Error {
  readonly currency: Currency;
  readonly available: number;

  constructor(currency: Currency, available: number) {
    super(
      `Saldo insuficiente en ${currency}. Máximo disponible para aportar: ${available} ${currency}`
    );
    this.name = "GoalInsufficientBalanceError";
    this.currency = currency;
    this.available = available;
  }
}

const SUPPORTED_CURRENCIES = ["USD", "EUR", "COP"] as const;
const MAX_NAME_LENGTH = 120;

const round2 = (n: number) => Math.round(n * 100) / 100;

const toProgress = (current: number, target: number): number => {
  if (current >= target) {
    return 100;
  }
  return Math.round((current / target) * 10000) / 100;
};

const withProgress = (goal: Goal): Goal => {
  const progress = toProgress(goal.currentAmount, goal.targetAmount);
  return {
    ...goal,
    progress,
    completed: progress >= 100,
  };
};

export const createGoal = async (
  input: CreateGoalInput,
  db: Queryable = pool
): Promise<Goal> => {
  const name = input.name.trim();

  if (!name) {
    throw new GoalValidationError("El nombre de la meta no puede estar vacío.");
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new GoalValidationError(
      `El nombre de la meta no puede superar ${MAX_NAME_LENGTH} caracteres.`
    );
  }
  if (!SUPPORTED_CURRENCIES.includes(input.currency)) {
    throw new GoalValidationError(
      `La moneda ${input.currency} no está soportada (solo USD, EUR o COP).`
    );
  }
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    throw new GoalValidationError(
      "El monto objetivo debe ser un número positivo."
    );
  }

  const goal = await createGoalRow(
    {
      userId: input.userId,
      name,
      currency: input.currency,
      targetAmount: round2(input.targetAmount),
    },
    db
  );

  return withProgress(goal);
};

export const listGoalsByUserId = async (
  userId: number,
  db: Queryable = pool
): Promise<Goal[]> => {
  const goals = await findGoalsByUserId(userId, db);
  return goals.map(withProgress);
};

export const addContribution = async (
  input: AddToGoalInput,
  db: Queryable = pool
): Promise<Goal> => {
  const amount = round2(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new GoalValidationError("El aporte debe ser un número positivo.");
  }

  return withTransaction(db, async (client) => {
    const goal = await findGoalById(input.goalId, client);
    if (!goal || goal.userId !== input.userId) {
      throw new GoalNotFoundError(input.goalId);
    }

    const wallet = await getWalletByUserId(input.userId, client);
    const balance = await getBalanceByWalletAndCurrency(
      wallet.id,
      goal.currency,
      client
    );

    if (!balance) {
      throw new GoalInsufficientBalanceError(goal.currency, 0);
    }
    if (balance.amount < amount) {
      throw new GoalInsufficientBalanceError(goal.currency, balance.amount);
    }

    await addToBalance(wallet.id, goal.currency, -amount, client);

    const updated = await addToGoalAmount(
      input.goalId,
      input.userId,
      amount,
      client
    );
    if (!updated) {
      throw new GoalNotFoundError(input.goalId);
    }

    return withProgress(updated);
  });
};

export const withdrawFromGoal = async (
  input: WithdrawGoalInput,
  db: Queryable = pool
): Promise<Goal> => {
  const amount = round2(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new GoalValidationError("El retiro debe ser un número positivo.");
  }

  return withTransaction(db, async (client) => {
    const goal = await findGoalById(input.goalId, client);
    if (!goal || goal.userId !== input.userId) {
      throw new GoalNotFoundError(input.goalId);
    }

    if (goal.currentAmount < amount) {
      throw new GoalValidationError(
        `El retiro no puede superar lo ahorrado en la meta (actual: ${goal.currentAmount} ${goal.currency}).`
      );
    }

    const wallet = await getWalletByUserId(input.userId, client);

    await addToBalance(wallet.id, goal.currency, amount, client);

    const updated = await subtractFromGoalAmount(
      input.goalId,
      input.userId,
      amount,
      client
    );
    if (!updated) {
      throw new GoalValidationError(
        "El retiro no pudo aplicarse: la meta no tiene ahorro suficiente."
      );
    }

    return withProgress(updated);
  });
};

export const removeGoal = async (
  userId: number,
  goalId: number,
  db: Queryable = pool
): Promise<void> => {
  const goal = await findGoalById(goalId, db);
  if (!goal || goal.userId !== userId) {
    throw new GoalNotFoundError(goalId);
  }
  await deleteGoalRow(goalId, userId, db);
};

export const goalsService = {
  createGoal,
  listGoalsByUserId,
  addContribution,
  withdrawFromGoal,
  removeGoal,
};