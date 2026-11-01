import { api } from "./client";

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  displayName: string;
  role: "Admin" | "Trabajador";
  jobTitle: string | null;
}

export async function register(email: string, password: string, displayName: string) {
  const { data } = await api.post<AuthResponse>("/auth/register", { email, password, displayName });
  return data;
}

export async function registerWorker(firstName: string, lastName: string, password: string) {
  const { data } = await api.post<AuthResponse>("/auth/register-worker", { firstName, lastName, password });
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<AuthResponse>("/auth/login", { email, password });
  return data;
}
