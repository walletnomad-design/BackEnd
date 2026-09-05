import type { Request, Response } from "express";
import type { Currency } from "../types";

import {
  createGoal,
  listGoalsByUserId,
  addContribution,
  removeGoal,
  GoalValidationError,
  GoalNotFoundError,
} from "../services/goals.service";

const SUPPORTED_CURRENCIES: Currency[] = ["USD", "EUR", "COP"];

const getGoalId = (
  value: string | string[] | undefined
): number | null => {
  if (typeof value !== "string") {
    return null;
  }

  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

export const createGoalController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId;
  const { name, currency, targetAmount } = req.body;

  if (
    typeof name !== "string" ||
    !SUPPORTED_CURRENCIES.includes(currency as Currency) ||
    typeof targetAmount !== "number"
  ) {
    res.status(400).json({
      error: "INVALID_INPUT",
      message: "Datos de la meta inválidos",
    });
    return;
  }

  try {
    const goal = await createGoal({
      userId,
      name,
      currency: currency as Currency,
      targetAmount,
    });

    res.status(201).json({ goal });
  } catch (error) {
    if (error instanceof GoalValidationError) {
      res.status(400).json({
        error: "GOAL_VALIDATION_ERROR",
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
};

export const listGoalsController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = res.locals.userId;
    const goals = await listGoalsByUserId(userId);

    res.status(200).json({ goals });
  } catch {
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
};

export const addContributionController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId;
  const goalId = getGoalId( req.params.id);
  const { amount } = req.body;

  if (goalId === null || typeof amount !== "number") {
    res.status(400).json({
      error: "INVALID_INPUT",
      message: "Datos del aporte inválidos",
    });
    return;
  }

  try {
    const goal = await addContribution({
      userId,
      goalId,
      amount,
    });

    res.status(200).json({ goal });
  } catch (error) {
    if (error instanceof GoalValidationError) {
      res.status(400).json({
        error: "GOAL_VALIDATION_ERROR",
        message: error.message,
      });
      return;
    }

    if (error instanceof GoalNotFoundError) {
      res.status(404).json({
        error: "GOAL_NOT_FOUND",
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
};

export const removeGoalController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId;
  const goalId = getGoalId(req.params.id);

  if (goalId === null) {
    res.status(400).json({
      error: "INVALID_GOAL_ID",
      message: "ID de meta inválido",
    });
    return;
  }

  try {
    await removeGoal(userId, goalId);

    res.status(204).send();
  } catch (error) {
    if (error instanceof GoalNotFoundError) {
      res.status(404).json({
        error: "GOAL_NOT_FOUND",
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
};