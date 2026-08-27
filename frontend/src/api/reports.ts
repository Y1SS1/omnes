import { api } from "./client";
import type {
  ExpenseCategorySlice,
  HabitCompletionReportItem,
  ProductivityPoint,
  SavingsComparisonDto,
  TaskCategorySlice,
} from "./types";

export async function getHabitCompletionReport(year: number, month: number) {
  const { data } = await api.get<HabitCompletionReportItem[]>("/reports/habit-completion", {
    params: { year, month },
  });
  return data;
}

export async function getProductivityTimeline(from: string, to: string) {
  const { data } = await api.get<ProductivityPoint[]>("/reports/productivity-timeline", {
    params: { from, to },
  });
  return data;
}

export async function getTaskCategoriesReport(year: number, month: number) {
  const { data } = await api.get<TaskCategorySlice[]>("/reports/task-categories", { params: { year, month } });
  return data;
}

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
