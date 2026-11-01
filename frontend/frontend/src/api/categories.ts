import { api } from "./client";
import type { Category, CategoryType } from "./types";

export async function getCategories(type?: CategoryType) {
  const { data } = await api.get<Category[]>("/categories", { params: type ? { type } : undefined });
  return data;
}

export async function createCategory(name: string, color: string, type: CategoryType) {
  const { data } = await api.post<Category>("/categories", { name, color, type });
  return data;
}

export async function deleteCategory(id: string) {
  await api.delete(`/categories/${id}`);
}
