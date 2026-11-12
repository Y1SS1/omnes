import { api } from "./client";
import type { PlannedBudgetReportDto } from "./types";

// Without a projectId the API analyses the budget the wallet executes.
export async function getPlannedBudget(projectId?: string | null) {
  const { data } = await api.get<PlannedBudgetReportDto>("/reports/planned-budget", {
    params: projectId ? { projectId } : undefined,
  });
  return data;
}
