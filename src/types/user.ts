/**
 * Rol del usuario en la app. `admin` habilita el panel administrativo
 * (middleware `requireAdmin` de P3); el registro siempre crea 'user'.
 */
export type UserRole = "user" | "admin";

export interface User {
  id: number;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  dni?: string;
  role: UserRole;
  createdAt: string;
}

export interface PublicUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  dni?: string;
  role?: UserRole;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  dni?: string;
}