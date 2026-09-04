export interface User {
  id: number;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  dni?: string;
  createdAt: string;
}

export interface PublicUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  dni?: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  dni?: string;
}