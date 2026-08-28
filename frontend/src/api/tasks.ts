import { api } from "./client";
import type { DeadlineScope, TaskItemDto, TaskKind } from "./types";

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  kind: TaskKind;
  deadlineScope: DeadlineScope;
  dueAt?: string | null;
  isRepetitive: boolean;
  repeatDays: string; // comma-separated day names or "None"
  categoryId?: string | null;
}

export async function getTasks(params?: { scope?: DeadlineScope; kind?: TaskKind }) {
  const { data } = await api.get<TaskItemDto[]>("/tasks", { params });
  return data;
}

export async function getHabits(date?: string, all?: boolean) {
  const params: Record<string, string | boolean> = {};
  if (date) params.date = date;
  if (all) params.all = true;
  const { data } = await api.get<TaskItemDto[]>("/tasks/habits", { params });
  return data;
}

export async function getCalendar(year: number, month: number) {
  const { data } = await api.get<TaskItemDto[]>("/tasks/calendar", { params: { year, month } });
  return data;
}

export async function createTask(input: CreateTaskInput) {
  const { data } = await api.post<TaskItemDto>("/tasks", input);
  return data;
}

export async function updateTask(id: string, input: Omit<CreateTaskInput, "kind">) {
  const { data } = await api.put<TaskItemDto>(`/tasks/${id}`, input);
  return data;
}

export async function toggleTaskComplete(id: string) {
  const { data } = await api.post<TaskItemDto>(`/tasks/${id}/complete`);
  return data;
}

export async function toggleHabit(id: string, date?: string) {
  const { data } = await api.post<TaskItemDto>(`/tasks/${id}/toggle-habit`, null, {
    params: date ? { date } : undefined,
  });
  return data;
}

export async function deleteTask(id: string) {
  await api.delete(`/tasks/${id}`);
}
