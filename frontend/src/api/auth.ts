import { api } from "./client";

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  displayName: string;
}

export async function register(email: string, password: string, displayName: string) {
  const { data } = await api.post<AuthResponse>("/auth/register", { email, password, displayName });
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthResponse>("/auth/login", { email, password });
  return data;
}
