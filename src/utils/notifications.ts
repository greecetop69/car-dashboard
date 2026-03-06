import type { NotificationItem } from "../types/notification";

export function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU");
}

export function isNotificationNavigable(item: NotificationItem) {
  return Boolean(item.carOrigin && item.carSourceId);
}
