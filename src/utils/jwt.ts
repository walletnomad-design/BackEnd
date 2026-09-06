import { sign, verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Falta la variable JWT_SECRET");
}

export type UserRole = "user" | "admin";

export const generateToken = (
  userId: number,
  role: UserRole = "user"
): string => {
  return sign(
    { userId, role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
};

export const verifyToken = (token: string) => {
  return verify(token, JWT_SECRET);
};