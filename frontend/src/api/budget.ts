import { api } from "./client";
import type { BudgetProgressDto } from "./types";

export async function getBudget(year: number, month: number) {
  const { data } = await api.get<BudgetProgressDto>("/budget", { params: { year, month } });
  return data;
}

export async function setBudget(year: number, month: number, limitAmount: number) {
  const { data } = await api.post<BudgetProgressDto>("/budget", { year, month, limitAmount });
  return data;
}
