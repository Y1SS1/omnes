import { api } from "./client";

export interface WorkerDto {
  id: string;
  email: string;
  displayName: string;
  jobTitle: string | null;
  createdAt: string;
}

export async function getWorkers() {
  const { data } = await api.get<WorkerDto[]>("/workers");
  return data;
}

export async function updateWorker(id: string, displayName: string, email: string, jobTitle: string | null) {
  const { data } = await api.put<WorkerDto>(`/workers/${id}`, { displayName, email, jobTitle });
  return data;
}

export async function deleteWorker(id: string) {
  await api.delete(`/workers/${id}`);
}
