import { api } from "./client";
import type { ExpenseCategorySlice, SavingsComparisonDto } from "./types";

export async function getSavingsComparison(year: number, month: number) {
  const { data } = await api.get<SavingsComparisonDto>("/reports/savings-comparison", { params: { year, month } });
  return data;
}

export async function getExpensesByCategory(year: number, month: number) {
  const { data } = await api.get<ExpenseCategorySlice[]>("/reports/expenses-by-category", {
    params: { year, month },
  });
  return data;
}
