import type { AddToGoalInput, CreateGoalInput, Goal } from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "../repositories/queryable";
import {
  addToGoalAmount,
  createGoal as createGoalRow,
  deleteGoal as deleteGoalRow,
  findGoalById,
  findGoalsByUserId,
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
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new GoalValidationError("El aporte debe ser un número positivo.");
  }

  const goal = await addToGoalAmount(
    input.goalId,
    input.userId,
    round2(input.amount),
    db
  );

  if (!goal) {
    throw new GoalNotFoundError(input.goalId);
  }

  return withProgress(goal);
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
  removeGoal,
};