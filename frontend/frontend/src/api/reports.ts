import { api } from "./client";
import type { PlannedBudgetReportDto } from "./types";

export async function getPlannedBudget() {
  const { data } = await api.get<PlannedBudgetReportDto>("/reports/planned-budget");
  return data;
}
