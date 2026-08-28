import { sign, verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Falta la variable JWT_SECRET");
}

export const generateToken = (userId: number): string => {
  return sign(
    { userId },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
};

export const verifyToken = (token: string) => {
  return verify(token, JWT_SECRET);
};