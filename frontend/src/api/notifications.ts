import { api } from "./client";
import type { NotificationDto } from "./types";

export async function getNotifications() {
  const { data } = await api.get<NotificationDto[]>("/notifications");
  return data;
}

export async function markNotificationRead(id: string) {
  await api.post(`/notifications/${id}/read`);
}

export async function deleteNotification(id: string) {
  await api.delete(`/notifications/${id}`);
}

export async function clearNotifications() {
  await api.delete("/notifications");
}
