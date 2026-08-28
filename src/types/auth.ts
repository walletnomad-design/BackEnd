import type { PublicUser } from "./user";

export interface JwtPayload {
  userId: number;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}