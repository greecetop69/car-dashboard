export type NotificationType = "new_car" | "price_drop" | "price_change" | "car_sold";

export interface NotificationItem {
  id: number;
  type: NotificationType;
  carOrigin: "encar" | "kbcha" | null;
  carSourceId: string | null;
  title: string;
  message: string;
  payload: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
}
