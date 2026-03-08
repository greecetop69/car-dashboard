import type { NotificationItem } from "../types/notification";

export function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU");
}

export function isNotificationNavigable(item: NotificationItem) {
  return Boolean(item.carOrigin && item.carSourceId);
}

export function getNotificationPhotoUrl(item: NotificationItem): string | null {
  const payload = item.payload;
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as Record<string, unknown>).mainPhoto;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

export interface NotificationDateGroup {
  key: string;
  label: string;
  items: NotificationItem[];
}

export function groupNotificationsByDate(items: NotificationItem[]): NotificationDateGroup[] {
  const groups = new Map<string, NotificationItem[]>();
  const now = new Date();
  const todayKey = toDayKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = toDayKey(yesterday);

  for (const item of items) {
    const date = new Date(item.createdAt);
    const key = Number.isNaN(date.getTime()) ? "unknown" : toDayKey(date);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, groupItems]) => {
      let label = key;
      if (key === todayKey) label = "Сегодня";
      else if (key === yesterdayKey) label = "Вчера";
      else if (key !== "unknown") {
        const [year, month, day] = key.split("-");
        label = `${day}.${month}.${year}`;
      } else {
        label = "Без даты";
      }
      return { key, label, items: groupItems };
    });
}

function toDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
