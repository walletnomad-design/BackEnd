import { hash, compare } from "bcrypt";

import { findUserByEmail, createUser } from "../repositories/user.repository";

import { createWalletForUser } from "../repositories/wallet.repository";

import { createInitialBalances } from "../repositories/balance.repository";

import { pool } from "../db/connection";

import { generateToken } from "../utils/jwt";

const SALT_ROUNDS = 10;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("El email ya está registrado");
    this.name = "EmailAlreadyExistsError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Credenciales inválidas");
    this.name = "InvalidCredentialsError";
  }
}

export class InvalidEmailError extends Error {
  constructor() {
    super("Email inválido");
    this.name = "InvalidEmailError";
  }
}

export class InvalidPasswordError extends Error {
  constructor() {
    super("La contraseña debe tener al menos 8 caracteres");
    this.name = "InvalidPasswordError";
  }
}

export const hashPassword = async (
  password: string
): Promise<string> => {
  return hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return compare(password, hashedPassword);
};

export const register = async (email: string, password: string) => {
  if (!EMAIL_REGEX.test(email)) {
    throw new InvalidEmailError();
  }

  if (password.length < 8) {
    throw new InvalidPasswordError();
  }

  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new EmailAlreadyExistsError();
  }

  const passwordHash = await hashPassword(password);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await createUser(
      { email, password: passwordHash },
      client
    );

    const wallet = await createWalletForUser(user.id, client);

    await createInitialBalances(wallet.id, client);

    await client.query("COMMIT");

    const token = generateToken(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const login = async (email: string, password: string) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw new InvalidCredentialsError();
  }

  const validPassword = await comparePassword(
    password,
    user.password
  );

  if (!validPassword) {
    throw new InvalidCredentialsError();
  }

  const token = generateToken(user.id);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
    },
  };
};