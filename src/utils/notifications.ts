import type { NotificationItem } from "../types/notification";
import { formatDateTimeChisinau, formatDayKeyChisinau } from "./dateTime";

export function formatNotificationDate(value: string) {
  return formatDateTimeChisinau(value);
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
  const todayKey = formatDayKeyChisinau(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = formatDayKeyChisinau(yesterday);

  for (const item of items) {
    const key = formatDayKeyChisinau(item.createdAt);
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
