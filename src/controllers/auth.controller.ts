import type { Request, Response } from "express";

import {
  register,
  login,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
} from "../services/auth.service";

export const registerUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      error: "INVALID_INPUT",
      message: "Email y password son obligatorios",
    });
    return;
  }

  try {
    const result = await register(email, password);

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof EmailAlreadyExistsError) {
      res.status(409).json({
        error: "EMAIL_ALREADY_EXISTS",
        message: error.message,
      });
      return;
    }

    throw error;
  }
};

export const loginUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      error: "INVALID_INPUT",
      message: "Email y password son obligatorios",
    });
    return;
  }

  try {
    const result = await login(email, password);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: error.message,
      });
      return;
    }

    throw error;
  }
};