import { api } from "./client";
import type { PlannedItemDto, UpdatePlannedItemRequest } from "./types";

export async function getPlannedItems() {
  const { data } = await api.get<PlannedItemDto[]>("/planned-items");
  return data;
}

// Copies the project's items into the wallet, replacing an earlier copy of the same project.
export async function transferFromProject(projectId: string) {
  const { data } = await api.post<PlannedItemDto[]>(`/planned-items/from-project/${projectId}`);
  return data;
}

export async function updatePlannedItem(id: string, request: UpdatePlannedItemRequest) {
  const { data } = await api.put<PlannedItemDto>(`/planned-items/${id}`, request);
  return data;
}

export async function deletePlannedItem(id: string) {
  await api.delete(`/planned-items/${id}`);
}
