import { api } from "./client";
import type { NotificationDto } from "./types";

export async function getNotifications() {
  const { data } = await api.get<NotificationDto[]>("/notifications");
  return data;
}

export async function markNotificationRead(id: string) {
  await api.post(`/notifications/${id}/read`);
}
