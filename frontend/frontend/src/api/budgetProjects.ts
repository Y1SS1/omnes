import { api } from "./client";
import type { BudgetItemDto, BudgetItemType, BudgetProjectDto, BudgetProjectSummaryDto } from "./types";

export async function importProject(name: string, file: File) {
  const form = new FormData();
  form.append("name", name);
  form.append("file", file);
  const { data } = await api.post<BudgetProjectDto>("/budget-projects/import", form);
  return data;
}

export async function getProjects() {
  const { data } = await api.get<BudgetProjectSummaryDto[]>("/budget-projects");
  return data;
}

export async function getProject(id: string) {
  const { data } = await api.get<BudgetProjectDto>(`/budget-projects/${id}`);
  return data;
}

export async function updateItemType(projectId: string, itemId: string, type: BudgetItemType) {
  const { data } = await api.patch<BudgetItemDto>(`/budget-projects/${projectId}/items/${itemId}/type`, { type });
  return data;
}

export async function quoteItem(projectId: string, itemId: string) {
  const { data } = await api.post<BudgetItemDto>(`/budget-projects/${projectId}/items/${itemId}/quote`);
  return data;
}

export async function downloadExcel(projectId: string) {
  const { data } = await api.get<Blob>(`/budget-projects/${projectId}/export`, { responseType: "blob" });
  return data;
}

// The API answers its errors as plain Spanish text, ready to show to the user.
export function apiErrorMessage(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: unknown } }).response?.data;
  return typeof data === "string" && data.length > 0 ? data : fallback;
}
