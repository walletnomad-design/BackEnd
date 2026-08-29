export interface User {
  id: number;
  email: string;
  password: string;
  createdAt: string;
}

export interface PublicUser {
  id: number;
  email: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
}