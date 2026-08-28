import { hash, compare } from "bcrypt";

const SALT_ROUNDS = 10;

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